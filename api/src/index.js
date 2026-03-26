// Servidor principal Express - orquesta el flujo RAG (ingesta, búsqueda, generación)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// Función para crear embeddings desde OpenAI / LangChain
import { embed } from "./openaiClient.js";
// Cliente de la base de datos vectorial (Chroma o fallback en memoria)
import { getCollection } from "./chromaClient.js";
// Cliente/adapter para el LLM (DeepSeek) que genera respuestas a partir del contexto
import { generateAnswer } from "./deepseek.js";
// Módulos nuevos para chunking, extracción multi-formato, LightRAG
import { smartChunk, chunkText, mergeSmallChunks } from "./chunking.js";
import { extractTextFromFile, getDocumentMetadata } from "./documentExtractor.js";
import { lightRAGSearch } from "./lightrag.js";
import { generateStreamingMarkdownResponse, setupStreamingResponse } from "./streaming.js";
import multer from "multer";

dotenv.config();

// Mapa para almacenar el estado de sesión de cada conversación
const sessionStates = new Map();

// Función para obtener o crear estado de sesión
function getSessionState(sessionId = 'default') {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      activeDocument: null, // 'image', 'pdf', null
      lastImageText: null,
      lastPdfContent: null,
      lastPdfMetadata: null
    });
  }
  return sessionStates.get(sessionId);
}

// Función para detectar intención del mensaje
function detectIntent(message) {
  const conversationalKeywords = [
    "gracias", "ok", "vale", "perfecto", "listo", "thanks", "hola", "buenas",
    "buenos días", "buenas tardes", "buenas noches", "adiós", "bye", "chau",
    "entendido", "claro", "sí", "no", "por favor", "disculpa", "perdón"
  ];

  const extractionKeywords = [
    "extrae", "extract", "texto", "text", "ocr", "lee", "read", "palabras", "words",
    "sólo", "solo", "devuelve", "return", "muestra", "show"
  ];

  const msg = message.toLowerCase().trim();

  // Si el mensaje es corto y contiene palabras conversacionales
  if (msg.split(' ').length <= 3 && conversationalKeywords.some(keyword => msg.includes(keyword))) {
    return "conversation";
  }

  // Detectar intención de extraer texto de imagen
  const hasExtraction = extractionKeywords.some(keyword => msg.includes(keyword));
  const hasImageWords = msg.includes("imagen") || msg.includes("image") || msg.includes("foto") || msg.includes("photo");
  if (hasExtraction && hasImageWords) {
    return "extract_image_text";
  }

  // Detectar intención de extraer texto de PDF/documento
  const hasPdfWords = msg.includes("pdf") || msg.includes("documento") || msg.includes("doc") || msg.includes("archivo");
  if (hasExtraction && hasPdfWords) {
    return "extract_pdf_text";
  }

  return "query";
}

// Función para detectar si la consulta es general (no requiere RAG)
function isGeneralQuery(question) {
  const generalKeywords = [
    "qué es", "cómo", "explica", "define", "qué significa", "por qué", "cuándo", "dónde", "quién",
    "qué son", "cómo funciona", "qué hace", "dime", "cuéntame", "habla", "describe"
  ];
  const documentKeywords = ["documento", "pdf", "archivo", "texto", "contenido", "página"];

  const lower = question.toLowerCase();
  const hasGeneral = generalKeywords.some(k => lower.includes(k));
  const hasDocument = documentKeywords.some(k => lower.includes(k));

  // Si tiene palabras generales y no menciona documentos, es general
  return hasGeneral && !hasDocument;
}

// Respuestas predefinidas para conversaciones
function getConversationalResponse(message) {
  const responses = {
    "gracias": "¡Con gusto! Si necesitas más ayuda con el documento, dime.",
    "thanks": "You're welcome! If you need more help with the document, let me know.",
    "ok": "¡Perfecto! ¿Hay algo más en lo que pueda ayudarte?",
    "vale": "¡Genial! ¿Necesitas algo más?",
    "perfecto": "¡Excelente! ¿Qué más puedo hacer por ti?",
    "listo": "¡Listo! ¿Hay algo más que quieras consultar?",
    "hola": "¡Hola! ¿En qué puedo ayudarte hoy?",
    "buenas": "¡Buenas! ¿Cómo puedo asistirte?",
    "adiós": "¡Hasta luego! Que tengas un buen día.",
    "bye": "¡Adiós! Nos vemos pronto."
  };

  const msg = message.toLowerCase().trim();
  for (const [key, response] of Object.entries(responses)) {
    if (msg.includes(key)) {
      return response;
    }
  }

  return "¡Entendido! Si tienes alguna pregunta sobre el documento, estoy aquí para ayudar.";
}

// Inicialización de Express y middlewares
const app = express();
app.use(cors({
  origin: [
    "https://chatbot-word.vercel.app",
    "https://chatbot-word-2ox7uv19h-elizabeth-huarcaya-2b27d044.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://chatbot-word-production.up.railway.app"
  ],
  methods: ["GET", "POST"]
}));
// Permitimos JSON con un límite razonable para evitar cargas excesivas
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

// Endpoint para ingestar documentos: recibe un array de objetos {id,text,metadata}
// Convierte cada texto en chunks, genera embeddings y los guarda en la colección vectorial
app.post("/ingest", async (req, res) => {
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

        // Aplicar chunking si es habilitado
        let chunks = [{ text, tokens: Math.ceil(text.length / 4) }];
        if (useChunking && text.length > 2048) {
          chunks = smartChunk(text); // Usar smart chunking para textos largos
          chunks = mergeSmallChunks(chunks, 100); // Fusionar chunks muy pequeños
          stats.chunked += chunks.length;
        } else {
          stats.chunked += 1;
        }

        // Procesar cada chunk
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

        // Guardar en base de datos vectorial
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
});

app.post("/query", async (req, res) => {
  try {
    const { question, k = 4, collection: collectionName = "documents", useLightRAG = true, sessionId = 'default' } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    const sessionState = getSessionState(sessionId);

    // Detectar intención del mensaje
    const intent = detectIntent(question);
    if (intent === "conversation") {
      const response = getConversationalResponse(question);
      const stream = setupStreamingResponse(res);
      stream.sendChunk(response);
      stream.sendComplete({ intent: "conversation" });
      return;
    }

    // Setup streaming
    const stream = setupStreamingResponse(res);

    try {
      // Si hay un documento activo (imagen o PDF), responder solo con ese contenido
      if (sessionState.activeDocument === 'image' && sessionState.lastImageText) {
        const imageContext = `Texto extraído de la imagen:\n${sessionState.lastImageText}`;
        await generateStreamingMarkdownResponse(
          imageContext,
          question,
          true, // usar DeepSeek
          (token) => stream.sendChunk(token)
        );
        stream.sendComplete({
          context: imageContext,
          docs: [{ content: sessionState.lastImageText, metadata: { source: 'active_image' } }],
          usedLightRAG: false,
          intent: "query_active_image"
        });
        return;
      }

      if (sessionState.activeDocument === 'pdf' && sessionState.lastPdfContent) {
        const pdfContext = `Contenido del documento PDF:\n${sessionState.lastPdfContent}`;
        await generateStreamingMarkdownResponse(
          pdfContext,
          question,
          true, // usar DeepSeek
          (token) => stream.sendChunk(token)
        );
        stream.sendComplete({
          context: pdfContext,
          docs: [{ content: sessionState.lastPdfContent, metadata: { source: 'active_pdf', ...sessionState.lastPdfMetadata } }],
          usedLightRAG: false,
          intent: "query_active_pdf"
        });
        return;
      }

      const collection = await getCollection(collectionName);

      // Detectar si es consulta general
      const isGeneral = isGeneralQuery(question);
      let docs = [];
      let usedLightRAGActual = useLightRAG;

      if (!isGeneral) {
        // Solo buscar si no es general
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
            console.warn("LightRAG fallback a búsqueda estándar:", lightragErr);
            // Fallback a búsqueda estándar
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
          // Búsqueda estándar (sin LightRAG)
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
      } else {
        usedLightRAGActual = false; // Para consultas generales, no usar RAG
      }

      const context = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");

      // Formatear pregunta
      let formattedQuestion;
      if (/^\s*hola\b/i.test(question)) {
        formattedQuestion = `Responde con un saludo breve y amigable, usando emojis si lo deseas y en formato markdown. ${question}`;
      } else {
        formattedQuestion = `Por favor responde de manera clara y organizada EN MARKDOWN. Usa headings (##), **negrita**, *cursiva*, listas - bullet, 1. numeradas según corresponda. ${question}`;
      }

      // Generar respuesta con streaming
      await generateStreamingMarkdownResponse(
        context,
        formattedQuestion,
        true, // usar DeepSeek
        (token) => stream.sendChunk(token)
      );

      stream.sendComplete({ context, docs, usedLightRAG: usedLightRAGActual });
    } catch (err) {
      stream.sendError(err);
    }
  } catch (err) {
    console.error("/query error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Debug endpoint: list indexed documents (ids, metadatas, sample text)
app.get("/debug/docs", async (req, res) => {
  try {
    const collection = await getCollection("documents");
    // Try multiple read APIs
    if (typeof collection.get === "function") {
      const all = await collection.get();
      return res.json({ source: "chroma.get", data: all });
    }

    if (typeof collection.list === "function") {
      const all = await collection.list();
      return res.json({ source: "chroma.list", data: all });
    }

    // In-memory fallback shape
    if (collection && collection.documents && Array.isArray(collection.documents)) {
      const items = collection.documents.map((d, i) => ({ id: collection.ids?.[i] ?? i, text: d, metadata: collection.metadatas?.[i] ?? {} }));
      return res.json({ source: "in-memory", data: items });
    }

    // Generic fallback: try reading properties
    const maybe = { documents: collection.documents || null, ids: collection.ids || null, metadatas: collection.metadatas || null };
    res.json({ source: "unknown-client", data: maybe });
  } catch (err) {
    console.error("/debug/docs error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});


// upload endpoint for documents (pdf, md, txt, docx, xlsx, pptx, images with OCR)
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });

    const { sessionId = 'default' } = req.body;
    const sessionState = getSessionState(sessionId);

    const originalName = req.file.originalname;
    const buf = req.file.buffer;
    
    console.log(`Processing upload: ${originalName} (${buf.length} bytes)`);

    // Extraer texto del archivo (automático según tipo)
    let text = "";
    try {
      text = await extractTextFromFile(buf, originalName);
    } catch (extractErr) {
      console.error("Extraction error:", extractErr);
      return res.status(400).json({ 
        error: `Could not extract text from ${originalName}: ${extractErr.message}` 
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "could not extract text from file" });
    }

    // Aplicar chunking
    const chunks = smartChunk(text);
    const mergedChunks = mergeSmallChunks(chunks, 100);

    console.log(`Extracted: ${text.length} chars, ${mergedChunks.length} chunks`);

    // Obtener metadatos
    const metadata = getDocumentMetadata(originalName, text);
    
    // Procesar chunks
    const ids = [];
    const documents = [];
    const metadatas = [];
    const embeddings = [];

    for (let i = 0; i < mergedChunks.length; i++) {
      const chunk = mergedChunks[i];
      const chunkId = `${originalName}#chunk-${i}`;
      const emb = await embed(chunk.text);

      ids.push(chunkId);
      documents.push(chunk.text);
      metadatas.push({
        ...metadata,
        chunkIndex: i,
        totalChunks: mergedChunks.length,
        tokens: chunk.tokens,
        uploadedAt: new Date().toISOString()
      });
      embeddings.push(emb);
    }

    // Guardar en BD vectorial
    const collection = await getCollection("documents");
    
    if (typeof collection.upsert === "function") {
      await collection.upsert({ ids, documents, metadatas, embeddings });
    } else if (typeof collection.add === "function") {
      await collection.add({ ids, documents, metadatas, embeddings });
    } else {
      return res.status(500).json({ error: "collection add/upsert not available" });
    }

    // Actualizar estado de sesión según tipo de archivo
    const isImageFile = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(originalName) || req.file.mimetype.startsWith("image/");
    if (isImageFile) {
      // Si fue una imagen, tratamos como documento de imagen
      sessionState.activeDocument = 'image';
      sessionState.lastImageText = text;
      sessionState.lastImageMetadata = metadata;
    } else {
      // Asumir documento (PDF/word/texto)
      sessionState.activeDocument = 'pdf';
      sessionState.lastPdfContent = text;
      sessionState.lastPdfMetadata = metadata;
    }

    res.json({
      ok: true,
      inserted: ids.length,
      id: originalName,
      textLength: text.length,
      chunksCount: mergedChunks.length,
      metadata
    });
  } catch (err) {
    console.error("/upload error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint para streaming response (opcional - respuesta por tokens)
app.post("/query/stream", async (req, res) => {
  try {
    const { question, k = 4, collection: collectionName = "documents" } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    // Detectar intención del mensaje
    const intent = detectIntent(question);
    if (intent === "conversation") {
      const response = getConversationalResponse(question);
      const stream = setupStreamingResponse(res);
      stream.sendChunk(response);
      stream.sendComplete({ intent: "conversation" });
      return;
    }

    // Setup streaming
    const stream = setupStreamingResponse(res);

    try {
      const collection = await getCollection(collectionName);
      
      // Búsqueda LightRAG
      const docs = await lightRAGSearch(question, collection, {
        k,
        useHybrid: true,
        compressContext: true,
        maxContextTokens: 2000
      });

      const context = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");

      let formattedQuestion = question;
      if (!/^\s*hola\b/i.test(question)) {
        formattedQuestion = `Por favor responde EN MARKDOWN con estructura clara. ${question}`;
      }

      // Generar respuesta con streaming
      await generateStreamingMarkdownResponse(
        context,
        formattedQuestion,
        true, // usar DeepSeek
        (token) => stream.sendChunk(token)
      );

      stream.sendComplete({ context, docsCount: docs.length });
    } catch (err) {
      stream.sendError(err);
    }
  } catch (err) {
    console.error("/query/stream error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint multimodal: texto + imagen en un mismo mensaje
app.post("/query-multimodal", upload.single("image"), async (req, res) => {
  try {
    const { question, useLightRAG = true, k = 4, sessionId = 'default' } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    const sessionState = getSessionState(sessionId);

    // Detectar intención del mensaje
    const intent = detectIntent(question);

    // inicializar variables de posible imagen adjunta
    let extractedImageText = "";
    let imageProcessingInfo = {};

    if (intent === "conversation" && !req.file) {
      const response = getConversationalResponse(question);
      return res.json({
        answer: response,
        docs: [],
        usedLightRAG: false,
        imageInfo: {},
        context: "",
        intent: "conversation"
      });
    }

    // Si la intención es extraer texto de imagen y hay imagen, devolver solo el texto
    if (intent === "extract_image_text" && req.file) {
      try {
        console.log(`\n📸 Extrayendo texto de imagen: ${req.file.originalname}`);
        const extractedText = await extractTextFromFile(req.file.buffer, req.file.originalname);
        console.log(`✅ Texto extraído: ${extractedText.length} caracteres\n`);

        // Actualizar estado de sesión
        sessionState.activeDocument = 'image';
        sessionState.lastImageText = extractedText;

        return res.json({
          answer: extractedText,
          docs: [],
          usedLightRAG: false,
          imageInfo: {
            filename: req.file.originalname,
            size: req.file.size,
            textExtracted: extractedText.length,
            tokens: Math.ceil(extractedText.length / 4)
          },
          context: "",
          intent: "extract_image_text"
        });
      } catch (imgErr) {
        console.error("Error extrayendo texto de imagen:", imgErr);
        return res.status(500).json({ error: `Error procesando imagen: ${imgErr.message}` });
      }
    }

    // Si la intención es extraer texto de imagen pero no hay imagen
    if (intent === "extract_image_text" && !req.file) {
      // si ya hay una imagen activa en la sesión, devolver su texto
      if (sessionState.activeDocument === 'image' && sessionState.lastImageText) {
        return res.json({
          answer: sessionState.lastImageText,
          docs: [{ content: sessionState.lastImageText, metadata: { source: 'active_image' } }],
          usedLightRAG: false,
          imageInfo: {},
          context: `Texto extraído de la imagen:\n${sessionState.lastImageText}`,
          intent: "query_active_image"
        });
      }
      return res.json({
        answer: "Para extraer texto de una imagen, por favor adjunta una imagen junto con tu mensaje.",
        docs: [],
        usedLightRAG: false,
        imageInfo: {},
        context: "",
        intent: "extract_image_text_no_image"
      });
    }

    // Si hay un documento activo, responder solo con ese contenido
    if (sessionState.activeDocument === 'image' && sessionState.lastImageText) {
      // Si la intención es extraer texto de imagen y no llegó un nuevo archivo, responder con texto puro
      if (intent === "extract_image_text" && !req.file) {
        return res.json({
          answer: sessionState.lastImageText,
          docs: [{ content: sessionState.lastImageText, metadata: { source: 'active_image' } }],
          usedLightRAG: false,
          imageInfo: imageProcessingInfo,
          context: `Texto extraído de la imagen:\n${sessionState.lastImageText}`,
          intent: "query_active_image"
        });
      }

      const imageContext = `Texto extraído de la imagen:\n${sessionState.lastImageText}`;
      const combinedContext = extractedImageText ? `${imageContext}\n\n---\n\nTexto de nueva imagen:\n${extractedImageText}` : imageContext;
      const answer = await generateAnswer(question, combinedContext, []);
      return res.json({
        answer,
        docs: [{ content: sessionState.lastImageText, metadata: { source: 'active_image' } }],
        usedLightRAG: false,
        imageInfo: imageProcessingInfo,
        context: combinedContext,
        intent: "query_active_image"
      });
    }

    if (sessionState.activeDocument === 'pdf' && sessionState.lastPdfContent) {
      // si la intención es extraer texto del PDF sin volver a subir el archivo
      if (intent === "extract_pdf_text" && !req.file) {
        return res.json({
          answer: sessionState.lastPdfContent,
          docs: [{ content: sessionState.lastPdfContent, metadata: { source: 'active_pdf', ...sessionState.lastPdfMetadata } }],
          usedLightRAG: false,
          imageInfo: imageProcessingInfo,
          context: `Contenido del documento PDF:\n${sessionState.lastPdfContent}`,
          intent: "query_active_pdf"
        });
      }

      const pdfContext = `Contenido del documento PDF:\n${sessionState.lastPdfContent}`;
      const combinedContext = extractedImageText ? `${pdfContext}\n\n---\n\nTexto de imagen:\n${extractedImageText}` : pdfContext;
      const answer = await generateAnswer(question, combinedContext, []);
      return res.json({
        answer,
        docs: [{ content: sessionState.lastPdfContent, metadata: { source: 'active_pdf', ...sessionState.lastPdfMetadata } }],
        usedLightRAG: false,
        imageInfo: imageProcessingInfo,
        context: combinedContext,
        intent: "query_active_pdf"
      });
    }

    // Si llega cualquier archivo nuevo (imagen o documento) en este request, actualizar estado
    if (req.file) {
      sessionState.activeDocument = 'image';
      sessionState.lastImageText = extractedImageText;
    }

    // Combinar pregunta + texto de imagen
    const combinedContext = extractedImageText ? `${question}\n\n---\n\nTexto extraído de imagen:\n${extractedImageText}` : question;

    const collection = await getCollection("documents");

    // Usar LightRAG para búsqueda mejorada
    let docs = [];
    if (useLightRAG) {
      try {
        docs = await lightRAGSearch(combinedContext, collection, {
          k,
          useHybrid: true,
          rerankByDiversity: false,
          compressContext: true,
          maxContextTokens: 2000
        });
      } catch (lightragErr) {
        console.warn("LightRAG fallback:", lightragErr);
        const qEmb = await embed(question);
        const results = await collection.query({
          query_embeddings: [qEmb],
          n_results: k,
          include: ["metadatas", "documents"]
        });

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
      const results = await collection.query({
        query_embeddings: [qEmb],
        n_results: k,
        include: ["metadatas", "documents"]
      });

      if (results?.results?.[0]?.documents) {
        const first = results.results[0];
        const documents = first.documents || [];
        docs = documents.map((text, idx) => ({
          text,
          metadata: first.metadatas?.[idx] || {}
        }));
      }
    }

    const context = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");

    // Generar respuesta
    const formattedQuestion = `👤 Usuario: ${question}${extractedImageText ? '\n\n📋 De la imagen adjunta: ' + extractedImageText.substring(0, 200) + '...' : ''}`;

    const answer = await generateAnswer(formattedQuestion, context, true);

    res.json({
      answer,
      docs,
      usedLightRAG: true,
      imageInfo: imageProcessingInfo,
      context
    });
  } catch (err) {
    console.error("/query-multimodal error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint de salud
app.get("/health", (req, res) => res.json({ 
  status: "ok", 
  features: ["chunking", "multi-format", "lightrag", "streaming", "markdown"]
}));

// --- ENDPOINT RAÍZ ---
app.get("/", (req, res) => {
  res.send("🟢 RAG API corriendo. Usa /query, /upload o /ingest para interactuar.");
});

app.listen(PORT, () => console.log(`RAG API listening on http://localhost:${PORT}`));
