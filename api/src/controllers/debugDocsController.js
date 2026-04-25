// Controlador para /debug/docs
import { getCollection } from "../data/chromaClient.js";

export async function debugDocsHandler(req, res) {
  try {
    const collection = await getCollection("documents");
    if (typeof collection.get === "function") {
      const all = await collection.get();
      const data = all.ids?.map((id, i) => ({
        id,
        textLength: all.documents?.[i]?.length || 0,
        textPreview: all.documents?.[i]?.substring(0, 300) || "(vacío)",
        embeddingLength: all.embeddings?.[i]?.length || 0,
        metadata: all.metadatas?.[i]
      })) || [];
      return res.json({
        source: "in-memory",
        count: all.ids?.length || 0,
        totalChars: all.documents?.reduce((sum, d) => sum + (d?.length || 0), 0) || 0,
        data
      });
    }
    return res.json({ source: "unknown", data: [], count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}