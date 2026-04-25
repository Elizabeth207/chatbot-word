import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const useMockEmbeddingsByDefault = !OPENAI_API_KEY || OPENAI_API_KEY.toLowerCase().startsWith("mock");

let client = null;
if (!useMockEmbeddingsByDefault) {
  try {
    client = new OpenAI({ apiKey: OPENAI_API_KEY });
  } catch (err) {
    console.warn("No se pudo inicializar OpenAI:", err.message || err);
  }
}

function createMockEmbedding(text) {
  const hash = Array.from(text).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return Array.from({ length: 1536 }, (_, i) => Math.sin(hash + i));
}

export async function embed(text) {
  if (!text) return [];
  if (!client) {
    return createMockEmbedding(text);
  }
  try {
    const resp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return resp.data[0].embedding;
  } catch (err) {
    console.warn("Error en OpenAI API para embeddings:", err.code || err.message);
    return createMockEmbedding(text);
  }
}

export default client;
