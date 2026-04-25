// Controlador para /ingest
import { getCollection } from "../data/chromaClient.js";
import { embed } from "../services/openaiClient.js";
import { smartChunk, mergeSmallChunks } from "../utils/chunking.js";

export async function ingestDocuments(req, res) {
  try {
    const { documents, collection: collectionName = "documents", useChunking = true } = req.body;
    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: "documents must be an array" });
    }
    const collection = await getCollection(collectionName);
    const stats = { total: 0, chunked: 0, errors: 0 };
    for (const doc of documents) {
      try {
        const id = doc.id ?? `${Date.now()}-${Math.random()}`;
        let text = doc.text ?? doc.content ?? "";
        const metadata = doc.metadata ?? {};
        let chunks = [{ text, tokens: Math.ceil(text.length / 4) }];
        if (useChunking && text.length > 2048) {
          chunks = smartChunk(text);
          chunks = mergeSmallChunks(chunks, 100);
          stats.chunked += chunks.length;
        } else {
          stats.chunked += 1;
        }
        const ids = [];
        const texts = [];
        const metadatas = [];
        const embeddings = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkId = `${id}-chunk-${i}`;
          const emb = await embed(chunk.text);
          ids.push(chunkId);
          texts.push(chunk.text);
          metadatas.push({
            ...metadata,
            originalId: id,
            chunkIndex: i,
            totalChunks: chunks.length,
            tokens: chunk.tokens,
            source: metadata.source || "ingest"
          });
          embeddings.push(emb);
        }
        if (typeof collection.add === "function") {
          await collection.add({ ids, documents: texts, metadatas, embeddings });
        } else if (typeof collection.upsert === "function") {
          await collection.upsert({ ids, documents: texts, metadatas, embeddings });
        }
        stats.total += chunks.length;
      } catch (docErr) {
        console.error(`Error procesando documento:`, docErr);
        stats.errors += 1;
      }
    }
    res.json({ ok: true, ...stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
}
