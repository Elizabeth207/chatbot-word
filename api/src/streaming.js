import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const STREAM_TIMEOUT = 30000; // 30 segundos máximo

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
