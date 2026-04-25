// Servidor principal - importa todos los controladores
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env manualmente
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  }
}

console.log("🔑 OPENAI KEY:", process.env.OPENAI_API_KEY?.slice(0, 15));
console.log("🔑 DEEPSEEK KEY:", process.env.DEEPSEEK_API_KEY?.slice(0, 15));

// Importar configuración del servidor
import { app, upload } from "./serverSetup.js";

// Importar controladores
import { ingestDocuments } from "./ingestController.js";
import { queryHandler } from "./queryController.js";
import { uploadHandler } from "./uploadController.js";
import { queryStreamHandler } from "./queryStreamController.js";
import { debugDocsHandler } from "./debugDocsController.js";
import { multimodalHandler } from "./multimodalController.js";

const PORT = process.env.PORT || 3000;

// Rutas
app.post("/ingest", async (req, res) => await ingestDocuments(req, res));
app.post("/query", async (req, res) => await queryHandler(req, res));
app.post("/upload", upload.single("file"), async (req, res) => await uploadHandler(req, res));
app.post("/query/stream", async (req, res) => await queryStreamHandler(req, res));
app.post("/query-multimodal", upload.single("image"), async (req, res) => await multimodalHandler(req, res));
app.get("/debug/docs", async (req, res) => await debugDocsHandler(req, res));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 RAG API listening on http://localhost:${PORT}`);
});
