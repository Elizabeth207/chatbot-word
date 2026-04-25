// Controlador para /query
import { getSessionState } from "./sessionState.js";
import { detectIntent } from "./intentUtils.js";
import { getConversationalResponse } from "./conversationalResponses.js";
import { getCollection } from "../data/chromaClient.js";
import { embed } from "../services/openaiClient.js";
import { lightRAGSearch } from "../rag/lightrag.js";
import { generateStreamingMarkdownResponse, setupStreamingResponse } from "../services/streaming.js";

export async function queryHandler(req, res) {
  try {
    const { question, k = 4, collection: collectionName = "documents", useLightRAG = true, sessionId = 'default' } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });
    const sessionState = getSessionState(sessionId);
    const intent = detectIntent(question);
    if (intent === "conversation") {
      const response = getConversationalResponse(question);
      const stream = setupStreamingResponse(res);
      stream.sendChunk(response);
      stream.sendComplete({ intent: "conversation" });
      return;
    }
    const stream = setupStreamingResponse(res);
    const formattedQuestion = (/^\s*hola\b/i.test(question))
      ? `Responde con un saludo breve y amigable, usando emojis si lo deseas y en formato markdown. ${question}`
      : `Por favor responde de manera clara y organizada EN MARKDOWN. Usa headings (##), **negrita**, *cursiva*, listas - bullet, 1. numeradas según corresponda. ${question}`;
    try {
      let documentContext = "";
      let docs = [];
      let usedLightRAGActual = useLightRAG;
      if (sessionState.lastDocumentContent && sessionState.lastDocumentContent.trim().length > 20) {
        documentContext = `Contenido del documento ${sessionState.lastDocumentFilename}:\n\n${sessionState.lastDocumentContent}`;
        docs.push({
          text: sessionState.lastDocumentContent,
          metadata: {
            source: 'active_document_universal',
            filename: sessionState.lastDocumentFilename,
            ...sessionState.lastDocumentMetadata
          }
        });
      } else if (sessionState.activeDocument === 'image' && sessionState.lastImageText) {
        documentContext = `Texto extraído de la imagen:\n${sessionState.lastImageText}`;
        docs.push({ text: sessionState.lastImageText, metadata: { source: 'active_image' } });
      } else if (sessionState.activeDocument === 'pdf' && sessionState.lastPdfContent) {
        documentContext = `Contenido del documento PDF:\n${sessionState.lastPdfContent}`;
        docs.push({ text: sessionState.lastPdfContent, metadata: { source: 'active_pdf', ...sessionState.lastPdfMetadata } });
      }
      let retrievedContext = "";
      if (!documentContext) {
        const collection = await getCollection(collectionName);
        if (useLightRAG) {
          try {
            docs = await lightRAGSearch(question, collection, {
              k,
              useHybrid: true,
              rerankByDiversity: false,
              compressContext: true,
              maxContextTokens: 2000
            });
          } catch (lightragErr) {
            const qEmb = await embed(question);
            let results = null;
            if (typeof collection.query === "function") {
              results = await collection.query({
                query_embeddings: [qEmb],
                n_results: k,
                include: ["metadatas", "documents"]
              });
            } else {
              throw new Error("Chroma collection query API not found");
            }
            if (results?.results?.[0]?.documents) {
              const first = results.results[0];
              const documents = first.documents || [];
              docs = documents.map((text, idx) => ({
                text,
                metadata: first.metadatas?.[idx] || {}
              }));
            }
          }
        } else {
          const qEmb = await embed(question);
          let results = null;
          if (typeof collection.query === "function") {
            results = await collection.query({ query_embeddings: [qEmb], n_results: k, include: ["metadatas", "documents"] });
          } else {
            throw new Error("Chroma collection query API not found");
          }
          if (results?.results?.[0]?.documents) {
            const first = results.results[0];
            const documents = first.documents || [];
            docs = documents.map((text, idx) => ({
              text,
              metadata: first.metadatas?.[idx] || {}
            }));
          }
        }
        retrievedContext = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");
      }
      const contextFinal = [documentContext, retrievedContext].filter(Boolean).join("\n\n---\n\n");
      const hasContext = contextFinal.trim().length > 10;
      await generateStreamingMarkdownResponse(
        contextFinal,
        formattedQuestion,
        hasContext,
        (token) => stream.sendChunk(token)
      );
      stream.sendComplete({
        context: contextFinal,
        docs,
        usedLightRAG: usedLightRAGActual,
        intent: hasContext ? "query_with_context" : "chatbot_general"
      });
    } catch (err) {
      stream.sendError(err);
    }
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
