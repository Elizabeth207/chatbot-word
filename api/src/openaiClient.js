import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const useMockEmbeddingsByDefault = !OPENAI_API_KEY || OPENAI_API_KEY.toLowerCase().startsWith("mock");

let client = null;
if (!useMockEmbeddingsByDefault) {
  try {
    client = new OpenAI({ apiKey: OPENAI_API_KEY });
  } catch (err) {
    console.warn("No se pudo inicializar OpenAI, embeddings mock en este proceso:", err.message || err);
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
    console.warn("Error en OpenAI API para embeddings, fallback mock solo para esta petición:", err.code || err.message);
    return createMockEmbedding(text);
  }
}

export default client;
