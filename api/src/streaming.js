/**
 * Módulo de Streaming Response
 * Envía tokens de la respuesta del LLM en tiempo real
 * Máximo 5 segundos de respuesta
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const STREAM_TIMEOUT = 30000; // 30 segundos máximo

/**
 * Generar respuesta con streaming desde OpenAI
 */
export async function streamOpenAIResponse(context, question, onChunk) {
  const systemPrompt = context
    ? `You are a helpful AI assistant. Use the following context to answer questions accurately. If the context is not relevant or insufficient, supplement with your general knowledge. Respond in the same language as the question. Use markdown formatting for better readability.\n\nContext:\n${context}`
    : "You are a helpful AI assistant. Answer questions accurately and comprehensively. Respond in the same language as the question. Use markdown formatting when appropriate.";
  
  const stream = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
    timeout: STREAM_TIMEOUT
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

/**
 * Generar respuesta con streaming desde DeepSeek
 */
export async function streamDeepSeekResponse(context, question, onChunk) {
  const systemPrompt = context
    ? `You are a helpful AI assistant. Use the following context to answer questions accurately. If the context is not relevant or insufficient, supplement with your general knowledge. Respond in the same language as the question. Use markdown formatting for better readability.\n\nContext:\n${context}`
    : "You are a helpful AI assistant. Answer questions accurately and comprehensively. Respond in the same language as the question. Use markdown formatting when appropriate.";
  
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
      
      // Verificar timeout
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

/**
 * Wrap para Express res.json pero con streaming
 * Envía eventos Server-Sent Events (SSE)
 */
export function setupStreamingResponse(res) {
  // Headers para SSE
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

/**
 * Generar respuesta con markdown y tiempo límite
 */
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
  
  // Asegurar que está en markdown
  if (response && !response.includes('#') && !response.includes('*') && !response.includes('-')) {
    response = formatAsMarkdown(response);
  }
  
  return response;
}

/**
 * Convertir respuesta a formato markdown si no lo está
 */
export function formatAsMarkdown(text) {
  if (!text) return text;
  
  // Agregar markdown básico si falta
  let markdown = text;
  
  // Convertir números seguidos de puntos en listas  markdown = markdown.replace(/^\d+\.\s+/gm, '- ');
  
  // Agregar énfasis a palabras clave
  markdown = markdown.replace(/\b(importante|importante|crítico|clave)\b/gi, '**$1**');
  
  // Agregar saltos entre secciones
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
