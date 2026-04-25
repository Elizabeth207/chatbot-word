import OpenAI from 'openai';
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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const STREAM_TIMEOUT = 30000;

function buildAssistantSystemPrompt(context) {
  if (context && context.trim().length > 0) {
    return `You are a helpful document analysis assistant. Prioritize information from the provided document context when answering. If the context is insufficient, answer helpfully using your broader knowledge. Always respond in the same language as the question and use markdown formatting.\n\nContext:\n${context}`;
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
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error('Stream error:', err);
  }

  return fullResponse;
}

export async function streamGroqResponse(context, question, onChunk) {
  const systemPrompt = buildAssistantSystemPrompt(context);
  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    temperature: 0.7,
    max_tokens: 1024,
    stream: true
  };

  let fullResponse = '';
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(STREAM_TIMEOUT)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errText}`);
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
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error('Groq stream error:', err);
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

export async function generateStreamingMarkdownResponse(context, question, useDeepSeek = true, onChunk = null) {
  let response = '';
  const tokens = [];

  const chunkHandler = (token) => {
    tokens.push(token);
    if (onChunk) onChunk(token);
  };

  const providers = [
    { name: 'DeepSeek', key: DEEPSEEK_API_KEY, fn: () => streamDeepSeekResponse(context, question, chunkHandler) },
    { name: 'OpenAI', key: process.env.OPENAI_API_KEY, fn: () => streamOpenAIResponse(context, question, chunkHandler) },
    { name: 'Groq', key: GROQ_API_KEY, fn: () => streamGroqResponse(context, question, chunkHandler) }
  ];

  let lastError = null;

  for (const provider of providers) {
    if (!provider.key) {
      continue;
    }

    try {
      response = await provider.fn();
      if (response && response.length > 0) {
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    response = `Error generando respuesta. Todos los proveedores de IA fallaron: ${lastError?.message || 'Error desconocido'}`;
  }

  if (response && !response.includes('#') && !response.includes('*') && !response.includes('-')) {
    response = formatAsMarkdown(response);
  }

  return response;
}

function formatAsMarkdown(text) {
  if (!text) return text;
  let markdown = text;
  markdown = markdown.replace(/^\d+\.\s+/gm, '- ');
  markdown = markdown.replace(/\b(importante|crítico|clave)\b/gi, '**$1**');
  markdown = markdown.replace(/\n(?=[A-Z])/g, '\n\n');
  return markdown;
}
