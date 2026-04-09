import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env manualmente si dotenv no funciona
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  }
}

// Verificar que las claves se carguen correctamente
console.log("🔑 OPENAI KEY:", process.env.OPENAI_API_KEY?.slice(0, 15));
console.log("🔑 DEEPSEEK KEY:", process.env.DEEPSEEK_API_KEY?.slice(0, 15));
console.log("INDEX Env file path:", envPath);
console.log("INDEX Env file exists:", fs.existsSync(envPath));

import express from "express";
import cors from "cors";
import { embed } from "./openaiClient.js";
import { getCollection } from "./chromaClient.js";
import { generateAnswer } from "./deepseek.js";
import { smartChunk, chunkText, mergeSmallChunks } from "./chunking.js";
import { extractTextFromFile, getDocumentMetadata } from "./documentExtractor.js";
import { lightRAGSearch } from "./lightrag.js";
import { generateStreamingMarkdownResponse, setupStreamingResponse } from "./streaming.js";
import multer from "multer";

const PORT = process.env.PORT || 3000;

const sessionStates = new Map();

function getSessionState(sessionId = 'default') {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      // Estado antiguo (mantenido para compatibilidad)
      activeDocument: null,
      lastImageText: null,
      lastPdfContent: null,
      lastPdfMetadata: null,
      
      // Estado universal - NUEVO
      lastDocumentContent: null,
      lastDocumentMetadata: null,
      lastDocumentFilename: null
    });
  }
  return sessionStates.get(sessionId);
}

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

  if (msg.split(' ').length <= 3 && conversationalKeywords.some(keyword => msg.includes(keyword))) {
    return "conversation";
  }

  const hasExtraction = extractionKeywords.some(keyword => msg.includes(keyword));
  const hasImageWords = msg.includes("imagen") || msg.includes("image") || msg.includes("foto") || msg.includes("photo");
  if (hasExtraction && hasImageWords) {
    return "extract_image_text";
  }

  const hasPdfWords = msg.includes("pdf") || msg.includes("documento") || msg.includes("doc") || msg.includes("archivo");
  if (hasExtraction && hasPdfWords) {
    return "extract_pdf_text";
  }

  return "query";
}

function isGeneralQuery(question) {
  const generalKeywords = [
    "qué es", "cómo", "explica", "define", "qué significa", "por qué", "cuándo", "dónde", "quién",
    "qué son", "cómo funciona", "qué hace", "dime", "cuéntame", "habla", "describe"
  ];
  const documentKeywords = ["documento", "pdf", "archivo", "texto", "contenido", "página"];

  const lower = question.toLowerCase();
  const hasGeneral = generalKeywords.some(k => lower.includes(k));
  const hasDocument = documentKeywords.some(k => lower.includes(k));

  return hasGeneral && !hasDocument;
}

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
app.use(express.json({ limit: "2mb" }));

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
});

app.post("/query", async (req, res) => {
  try {
    const { question, k = 4, collection: collectionName = "documents", useLightRAG = true, sessionId = 'default' } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    console.log(`\n🔍 [/query] Nueva pregunta: "${question}" (sessionId: ${sessionId})`);
    
    const sessionState = getSessionState(sessionId);
    console.log(`📊 Estado de sesión: activeDocument = ${sessionState.activeDocument}`);

    const intent = detectIntent(question);
    if (intent === "conversation") {
      console.log(`💬 Detectado como conversación`);
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
        console.log(`⚠️  No hay documento activo en sesión, buscando en ChromaDB...`);

        const collection = await getCollection(collectionName);

        if (useLightRAG) {
          try {
            console.log(`[/query] Buscando con LightRAG para: "${question}"`);
            docs = await lightRAGSearch(question, collection, {
              k,
              useHybrid: true,
              rerankByDiversity: false,
              compressContext: true,
              maxContextTokens: 2000
            });
            console.log(`[/query] LightRAG encontró ${docs.length} documentos`);
          } catch (lightragErr) {
            console.warn("LightRAG fallback a búsqueda estándar:", lightragErr.message);
            const qEmb = await embed(question);
            console.log(`[/query] Embedding generado, buscando con query directo...`);
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
            console.log(`[/query] Búsqueda directa encontró ${docs.length} documentos`);
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
    console.error("/query error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Debug endpoint: list indexed documents (ids, metadatas, sample text)
app.get("/debug/docs", async (req, res) => {
  try {
    const collection = await getCollection("documents");
    console.log(`[debug/docs] Buscando documentos...`);
    
    if (typeof collection.get === "function") {
      const all = await collection.get();
      console.log(`[debug/docs] Encontrados ${all.ids?.length || 0} documentos`);
      
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
    console.error("/debug/docs error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});


const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });

    const { sessionId = 'default' } = req.body;
    const sessionState = getSessionState(sessionId);

    const originalName = req.file.originalname;
    const buf = req.file.buffer;

    console.log(`\n📁 [/upload] Procesando archivo: ${originalName} (${buf.length} bytes)`);

    let text = "";
    try {
      text = await extractTextFromFile(buf, originalName);
    } catch (extractErr) {
      console.error("❌ Error extrayendo:", extractErr.message);
      return res.status(400).json({ 
        error: `Could not extract text from ${originalName}: ${extractErr.message}` 
      });
    }

    if (!text || !text.trim()) {
      console.error("❌ El archivo está vacío después de extraer");
      return res.status(400).json({ error: "could not extract text from file" });
    }

    console.log(`✅ Extracción completada: ${text.length} caracteres`);

    const metadata = getDocumentMetadata(originalName, text);
    const isImageFile = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(originalName) || req.file.mimetype.startsWith("image/");

    // Generar embedding
    console.log(`⚙️  Generando embedding para búsqueda...`);
    let embedding;
    try {
      embedding = await embed(text);
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding inválido");
      }
      console.log(`✅ Embedding generado: ${embedding.length} dimensiones`);
    } catch (embedErr) {
      console.error("❌ Error en embedding:", embedErr.message);
      return res.status(500).json({ error: `Error generating embedding: ${embedErr.message}` });
    }

    // Indexar en la colección
    console.log(`📊 Indexando en ChromaDB...`);
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
      console.log(`✅ Documento indexado en colección`);
    } catch (indexErr) {
      console.error("❌ Error indexando:", indexErr.message);
      return res.status(500).json({ error: `Error indexing document: ${indexErr.message}` });
    }

    // Guardar en sessionState como documento activo
    if (isImageFile) {
      sessionState.activeDocument = 'image';
      sessionState.lastImageText = text;
      sessionState.lastImageMetadata = metadata;
      console.log(`📸 Documento activo: IMAGEN`);
    } else {
      sessionState.activeDocument = 'pdf';
      sessionState.lastPdfContent = text;
      sessionState.lastPdfMetadata = metadata;
      console.log(`📄 Documento activo: PDF/DOCUMENTO`);
    }

    // 🆕 GUARDAR EN ESTADO UNIVERSAL
    sessionState.lastDocumentContent = text;
    sessionState.lastDocumentMetadata = metadata;
    sessionState.lastDocumentFilename = originalName;
    
    console.log(`🎯 Documento guardado en estado universal (${text.length} caracteres)`);
    console.log(`✅ [/upload] Completado exitosamente\n`);

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
    console.error("❌ /upload error:", err.message);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/query/stream", async (req, res) => {
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
        compressContext: true,
        maxContextTokens: 2000
      });

      const context = docs.slice(0, k).map(d => d.text).join("\n\n---\n\n");

      let formattedQuestion = question;
      if (!/^\s*hola\b/i.test(question)) {
        formattedQuestion = `Por favor responde EN MARKDOWN con estructura clara. ${question}`;
      }

      await generateStreamingMarkdownResponse(
        context,
        formattedQuestion,
        true,
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

app.post("/query-multimodal", upload.single("image"), async (req, res) => {
  try {
    const { question, useLightRAG = true, k = 4, sessionId = 'default' } = req.body;
    if (!question) return res.status(400).json({ error: "question required" });

    const sessionState = getSessionState(sessionId);

    const intent = detectIntent(question);

    let extractedImageText = "";
    let imageProcessingInfo = {};
    let isUploadedImage = false;

    if (req.file) {
      const filename = req.file.originalname || "";
      const isImageFile = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(filename) || req.file.mimetype.startsWith("image/");
      isUploadedImage = isImageFile;

      try {
        extractedImageText = await extractTextFromFile(req.file.buffer, filename);
        const metadata = getDocumentMetadata(filename, extractedImageText);
        imageProcessingInfo = {
          filename,
          size: req.file.size,
          textExtracted: extractedImageText.length,
          tokens: Math.ceil(extractedImageText.length / 4)
        };

        if (isImageFile) {
          sessionState.activeDocument = 'image';
          sessionState.lastImageText = extractedImageText;
          sessionState.lastImageMetadata = metadata;
        } else {
          sessionState.activeDocument = 'pdf';
          sessionState.lastPdfContent = extractedImageText;
          sessionState.lastPdfMetadata = metadata;
        }

        // 🆕 GUARDAR EN ESTADO UNIVERSAL PARA PREGUNTAS DE SEGUIMIENTO
        sessionState.lastDocumentContent = extractedImageText;
        sessionState.lastDocumentMetadata = metadata;
        sessionState.lastDocumentFilename = filename;
        
        console.log(`🎯 Documento "${filename}" guardado en estado universal (${extractedImageText.length} caracteres)`);

        // 🔥 GUARDAR EN COLECCIÓN PARA QUE SE PUEDA BUSCAR
        const collection = await getCollection("documents");
        const docId = filename;
        const emb = await embed(extractedImageText);
        
        console.log(`[/query-multimodal] Indexando documento "${filename}" en colección...`);
        
        if (typeof collection.upsert === "function") {
          await collection.upsert({
            ids: [docId],
            documents: [extractedImageText],
            metadatas: [{
              ...metadata,
              tokens: Math.ceil(extractedImageText.length / 4),
              uploadedAt: new Date().toISOString(),
              isCompleteText: true
            }],
            embeddings: [emb]
          });
        } else if (typeof collection.add === "function") {
          await collection.add({
            ids: [docId],
            documents: [extractedImageText],
            metadatas: [{
              ...metadata,
              tokens: Math.ceil(extractedImageText.length / 4),
              uploadedAt: new Date().toISOString(),
              isCompleteText: true
            }],
            embeddings: [emb]
          });
        }
        
        console.log(`[/query-multimodal] ✅ Documento "${filename}" indexado correctamente`);
      } catch (extractErr) {
        console.error("Error extrayendo texto del archivo:", extractErr);
        return res.status(500).json({ error: `Error procesando el archivo: ${extractErr.message}` });
      }
    }

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

    if (intent === "extract_image_text" && req.file) {
      try {
        console.log(`\n📸 Extrayendo texto de imagen: ${req.file.originalname}`);
        const extractedText = await extractTextFromFile(req.file.buffer, req.file.originalname);
        console.log(`✅ Texto extraído: ${extractedText.length} caracteres\n`);

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

    if (intent === "extract_image_text" && !req.file) {
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

    if (sessionState.activeDocument === 'image' && sessionState.lastImageText) {
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
      const answer = await generateAnswer(combinedContext, question);
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
      const answer = await generateAnswer(combinedContext, question);
      return res.json({
        answer,
        docs: [{ content: sessionState.lastPdfContent, metadata: { source: 'active_pdf', ...sessionState.lastPdfMetadata } }],
        usedLightRAG: false,
        imageInfo: imageProcessingInfo,
        context: combinedContext,
        intent: "query_active_pdf"
      });
    }

    const extractedFileContext = extractedImageText ? `Texto extraído del archivo:\n${extractedImageText}` : "";
    const collection = await getCollection("documents");

    let docs = [];
    if (useLightRAG) {
      try {
        console.log(`[/query-multimodal] Buscando en colección con LightRAG...`);
        docs = await lightRAGSearch(question, collection, {
          k,
          useHybrid: true,
          rerankByDiversity: false,
          compressContext: true,
          maxContextTokens: 2000
        });
        console.log(`[/query-multimodal] LightRAG encontró ${docs.length} documentos`);
      } catch (lightragErr) {
        console.warn("LightRAG fallback:", lightragErr.message);
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
        console.log(`[/query-multimodal] Búsqueda directa encontró ${docs.length} documentos`);
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

    const finalContext = [
      extractedFileContext,
      context
    ].filter(Boolean).join("\n\n---\n\n");

    const answer = await generateAnswer(finalContext, question);

    res.json({
      answer,
      docs,
      usedLightRAG: true,
      imageInfo: imageProcessingInfo,
      context: finalContext
    });
  } catch (err) {
    console.error("/query-multimodal error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/health", (req, res) => res.json({ 
  status: "ok", 
  features: ["chunking", "multi-format", "lightrag", "streaming", "markdown"]
}));

app.get("/", (req, res) => {
  res.send("🟢 RAG API corriendo. Usa /query, /upload o /ingest para interactuar.");
});

app.listen(PORT, () => console.log(`RAG API listening on http://localhost:${PORT}`));
