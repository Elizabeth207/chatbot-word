import dotenv from "dotenv";
import OpenAI from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";

dotenv.config();

let useMockEmbeddings = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("mock");

let client;
let lcEmbeddings;
if (!useMockEmbeddings) {
  try {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    lcEmbeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.warn("No se pudo inicializar OpenAI, usando embeddings mock...");
    useMockEmbeddings = true;
  }
}

export async function embed(text) {
  if (!text) return [];
  if (useMockEmbeddings) {
    const hash = Array.from(text).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    const vec = [];
    for (let i = 0; i < 1536; i++) {
      vec.push(Math.sin(hash + i));
    }
    return vec;
  }

  try {
    if (lcEmbeddings) {
      return await lcEmbeddings.embedQuery(text);
    }
    const resp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return resp.data[0].embedding;
  } catch (err) {
    console.warn("Error en OpenAI API, usando embeddings mock. Error:", err.code || err.message);
    useMockEmbeddings = true;

    const hash = Array.from(text).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    const vec = [];
    for (let i = 0; i < 1536; i++) {
      vec.push(Math.sin(hash + i));
    }
    return vec;
  }
}

export default client;
