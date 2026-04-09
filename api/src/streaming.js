import OpenAI from 'openai';
import dotenv from 'dotenv';
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

console.log("STREAMING OPENAI KEY:", process.env.OPENAI_API_KEY?.slice(0, 15));
console.log("STREAMING CWD:", process.cwd());
console.log("STREAMING Env file path:", envPath);
console.log("STREAMING Env file exists:", fs.existsSync(envPath));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const STREAM_TIMEOUT = 30000; // 30 segundos máximo

function buildAssistantSystemPrompt(context) {
  if (context && context.trim().length > 0) {
    return `You are a helpful document analysis assistant. Prioritize information from the provided document context when answering. If the context contains the answer, use it. If the question requires general knowledge or the context is insufficient, answer helpfully using your broader knowledge while avoiding inventing facts. Always respond in the same language as the question and use markdown formatting for better readability.\n\nContext:\n${context}`;
  }

  return "You are a helpful AI assistant. Answer questions conversationally and helpfully, using markdown formatting when appropriate.";
}

export async function streamOpenAIResponse(context, question, onChunk) {
  const systemPrompt = buildAssistantSystemPrompt(context);

  const stream = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1024
  });

  let fullResponse = '';

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    if (token) {
      fullResponse += token;
      onChunk(token);
    }
  }

  return fullResponse;
}

export async function streamDeepSeekResponse(context, question, onChunk) {
  const systemPrompt = buildAssistantSystemPrompt(context);

  const payload = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1024
  };

  let fullResponse = '';
  const startTime = Date.now();

  try {
    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(STREAM_TIMEOUT)
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (Date.now() - startTime > STREAM_TIMEOUT) {
        reader.cancel();
        break;
      }

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            const token = json.choices?.[0]?.delta?.content || '';
            if (token) {
              fullResponse += token;
              onChunk(token);
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Stream timeout after 5 segundos');
    } else {
      console.error('Stream error:', err);
    }
  }

  return fullResponse;
}

export function setupStreamingResponse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  return {
    sendChunk: (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
    sendComplete: (metadata) => {
      res.write(`data: ${JSON.stringify({ complete: true, ...metadata })}\n\n`);
      res.end();
    },
    sendError: (error) => {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  };
}

export async function generateStreamingMarkdownResponse(
  context,
  question,
  useDeepSeek = true,
  onChunk = null
) {
  let response = '';
  const tokens = [];

  const chunkHandler = (token) => {
    tokens.push(token);
    if (onChunk) onChunk(token);
  };

  try {
    if (useDeepSeek && DEEPSEEK_API_KEY) {
      response = await streamDeepSeekResponse(context, question, chunkHandler);
    } else {
      response = await streamOpenAIResponse(context, question, chunkHandler);
    }
  } catch (err) {
    console.error('Streaming error:', err);
    response = `Error generating response: ${err.message}`;
  }

  if (response && !response.includes('#') && !response.includes('*') && !response.includes('-')) {
    response = formatAsMarkdown(response);
  }

  return response;
}

export function formatAsMarkdown(text) {
  if (!text) return text;

  let markdown = text;

  markdown = markdown.replace(/^\d+\.\s+/gm, '- ');

  markdown = markdown.replace(/\b(importante|importante|crítico|clave)\b/gi, '**$1**');

  markdown = markdown.replace(/\n(?=[A-Z])/g, '\n\n');

  return markdown;
}

export default {
  streamOpenAIResponse,
  streamDeepSeekResponse,
  setupStreamingResponse,
  generateStreamingMarkdownResponse,
  formatAsMarkdown,
  STREAM_TIMEOUT
};
