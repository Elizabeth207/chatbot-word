// Controlador para /query-multimodal
import { extractTextFromFile } from "../extractors/documentExtractor.js";
import { getSessionState } from "./sessionState.js";
import { generateStreamingMarkdownResponse } from "../services/streaming.js";

export async function multimodalHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const { originalname, buffer, mimetype } = req.file;
    const question = req.body.question || "Resume este documento";
    const sessionId = String(req.body.sessionId || "default").trim() || "default";

    const text = await extractTextFromFile(buffer, originalname, mimetype || "");

    const session = getSessionState(sessionId);
    session.activeDocument = 'multimodal';
    session.lastDocumentContent = text;
    session.lastDocumentFilename = originalname;
    
    // Responder usando el texto extraído como contexto
    const documentContext = `Contenido del documento:\n\n${text}`;
    const formattedQuestion = `Por favor responde de manera clara y organizada EN MARKDOWN. Usa headings (##), **negrita**, *cursiva*, listas según corresponda.\n\nPregunta: ${question}`;
    
    try {
      // Usar generateStreamingMarkdownResponse sin callback para obtener respuesta completa
      const answer = await generateStreamingMarkdownResponse(
        documentContext,
        formattedQuestion,
        true,
        null // sin callback, devuelve respuesta completa
      );
      
      res.json({ 
        answer, 
        docs: [{ text, metadata: { source: 'multimodal_document', filename: originalname } }],
        usedLightRAG: false
      });
    } catch (llmErr) {
      // Si falla el LLM, devolver el texto extraído directamente
      res.json({ 
        answer: text, 
        docs: [{ text, metadata: { source: 'multimodal_document', filename: originalname } }],
        usedLightRAG: false,
        warning: "Texto extraído sin análisis de LLM"
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
