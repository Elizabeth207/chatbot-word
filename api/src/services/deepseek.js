const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function generateAnswer(context, question) {
  if (!DEEPSEEK_API_KEY) {
    const ctx = (context || "").replace(/\r/g, "\n");
    const preview = ctx.slice(0, 500);
    return `MOCK ANSWER: No hay DEEPSEEK_API_KEY configurada.\nPregunta: ${question}\nContexto (primeros 500 chars): ${preview}...\n\nConfigura DEEPSEEK_API_KEY en .env para respuestas reales.`;
  }

  const systemPrompt = context && context.trim().length > 0
    ? `You are a helpful document analysis assistant. When answering questions, prioritize information from the uploaded documents provided in the context. If the question can be answered using the document context, use that information. For questions that cannot be fully answered from the documents, or for general knowledge questions, you may use your general knowledge to provide helpful responses. Always respond in the same language as the question and use markdown formatting for better readability.\n\nContext from uploaded documents:\n${context}`
    : "You are a helpful AI assistant. You can answer general questions, provide information on various topics, and help with document analysis when documents are uploaded. Respond in the same language as the question and use markdown formatting for better readability.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ],
    temperature: 0.7,
    max_tokens: 1024
  };

  try {
    const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      return `Error calling DeepSeek API: ${res.status}.`;
    }

    const data = await res.json();
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    return JSON.stringify(data);
  } catch (err) {
    return `Error: ${err.message}.`;
  }
}

export default { generateAnswer };
