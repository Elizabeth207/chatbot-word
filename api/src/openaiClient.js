import dotenv from "dotenv";
import OpenAI from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";

// Cargamos variables de entorno para que las claves estén disponibles
dotenv.config();

// Modo de prueba: si no hay OPENAI_API_KEY o empieza por 'mock', devolvemos embeddings simulados.
// Esto es útil para desarrollo local sin consumir créditos de OpenAI.
const useMockEmbeddings = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("mock");

let client;
let lcEmbeddings;
if (!useMockEmbeddings) {
  // Inicializamos cliente oficial y el wrapper de LangChain para embeddings
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  lcEmbeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
}

// Función pública para generar un embedding a partir de texto
export async function embed(text) {
  if (!text) return [];
  if (useMockEmbeddings) {
    // Generador determinístico de vectores para pruebas (no semántico real)
    const hash = Array.from(text).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    const vec = [];
    for (let i = 0; i < 1536; i++) {
      vec.push(Math.sin(hash + i));
    }
    return vec;
  }
  // Si está disponible LangChain, lo usamos por consistencia
  if (lcEmbeddings) {
    return await lcEmbeddings.embedQuery(text);
  }
  // Fallback: usar directamente el cliente OpenAI
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return resp.data[0].embedding;
}

// Exportamos el cliente directo por si se necesita hacer llamadas RAW a OpenAI
export default client;
