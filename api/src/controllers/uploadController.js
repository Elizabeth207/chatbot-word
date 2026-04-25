// Controlador para /upload
import { getSessionState } from "./sessionState.js";
import { getCollection } from "../data/chromaClient.js";
import { embed } from "../services/openaiClient.js";
import { extractTextFromFile, getDocumentMetadata } from "../extractors/documentExtractor.js";

export async function uploadHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const { sessionId = 'default' } = req.body;
    const sessionState = getSessionState(sessionId);
    const originalName = req.file.originalname;
    const buf = req.file.buffer;
    let text = "";
    try {
      text = await extractTextFromFile(buf, originalName, req.file.mimetype || "");
    } catch (extractErr) {
      return res.status(400).json({ error: `Could not extract text from ${originalName}: ${extractErr.message}` });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "could not extract text from file" });
    }
    const metadata = getDocumentMetadata(originalName, text);
    const isImageFile = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(originalName) || req.file.mimetype.startsWith("image/");
    let embedding;
    try {
      embedding = await embed(text);
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding inválido");
      }
    } catch (embedErr) {
      return res.status(500).json({ error: `Error generating embedding: ${embedErr.message}` });
    }
    const ids = [originalName];
    const documents = [text];
    const metadatas = [{
      ...metadata,
      tokens: Math.ceil(text.length / 4),
      uploadedAt: new Date().toISOString(),
      isCompleteText: true,
      documentType: isImageFile ? 'image' : 'pdf'
    }];
    const embeddings = [embedding];
    const collection = await getCollection("documents");
    try {
      if (typeof collection.upsert === "function") {
        await collection.upsert({ ids, documents, metadatas, embeddings });
      } else if (typeof collection.add === "function") {
        await collection.add({ ids, documents, metadatas, embeddings });
      } else {
        throw new Error("Colección sin método add/upsert");
      }
    } catch (indexErr) {
      return res.status(500).json({ error: `Error indexing document: ${indexErr.message}` });
    }
    if (isImageFile) {
      sessionState.activeDocument = 'image';
      sessionState.lastImageText = text;
      sessionState.lastImageMetadata = metadata;
    } else {
      sessionState.activeDocument = 'pdf';
      sessionState.lastPdfContent = text;
      sessionState.lastPdfMetadata = metadata;
    }
    sessionState.lastDocumentContent = text;
    sessionState.lastDocumentMetadata = metadata;
    sessionState.lastDocumentFilename = originalName;
    res.json({
      ok: true,
      inserted: 1,
      id: originalName,
      textLength: text.length,
      chunksCount: 1,
      metadata,
      isCompleteText: true,
      extractedText: text
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}