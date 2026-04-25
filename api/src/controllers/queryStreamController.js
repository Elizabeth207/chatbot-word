// Controlador para /query/stream
import { detectIntent } from "./intentUtils.js";
import { getConversationalResponse } from "./conversationalResponses.js";
import { getCollection } from "../data/chromaClient.js";
import { lightRAGSearch } from "../rag/lightrag.js";
import { generateStreamingMarkdownResponse, setupStreamingResponse } from "../services/streaming.js";

export async function queryStreamHandler(req, res) {
  try {
    const { question, k = 4, collection: collectionName = "documents" } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });
    const intent = detectIntent(question);
    if (intent === "conversation") {
      const response = getConversationalResponse(question);
      const stream = setupStreamingResponse(res);
      stream.sendChunk(response);
      stream.sendComplete({ intent: "conversation" });
      return;
    }
    const stream = setupStreamingResponse(res);
    try {
      const collection = await getCollection(collectionName);
      const docs = await lightRAGSearch(question, collection, {
        k,
        useHybrid: true,
        rerankByDiversity: false,
        compressContext: true,
        maxContextTokens: 2000
      });
      const context = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");
      const hasContext = context.trim().length > 10;
      const formattedQuestion = `Por favor responde de manera clara y organizada EN MARKDOWN. Usa headings (##), **negrita**, *cursiva*, listas - bullet, 1. numeradas según corresponda. ${question}`;
      await generateStreamingMarkdownResponse(
        context,
        formattedQuestion,
        hasContext,
        (token) => stream.sendChunk(token)
      );
      stream.sendComplete({ docs, intent: hasContext ? "query_with_context" : "chatbot_general" });
    } catch (err) {
      stream.sendError(err);
    }
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}