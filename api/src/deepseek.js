
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function generateAnswer(context, question) {
  if (!DEEPSEEK_API_KEY) {
    const ctx = (context || "").replace(/\r/g, "\n");
    const preview = ctx.slice(0, 500);
    return `MOCK ANSWER: No hay DEEPSEEK_API_KEY configurada.\nPregunta: ${question}\nContexto (primeros 500 chars): ${preview}...\n\nConfigura DEEPSEEK_API_KEY en .env para respuestas reales.`;
  }

  const systemPrompt = context && context.trim().length > 0
    ? `You are a document analysis assistant. Answer questions based ONLY on the provided context from uploaded documents. If the information is not available in the context, respond with "No se encontró información relevante en los documentos subidos." Do not use external knowledge or make assumptions. Respond in the same language as the question. Use markdown formatting for better readability.\n\nContext:\n${context}`
    : "You are a document analysis assistant. Since no documents have been uploaded or found, I cannot provide information. Please upload documents first and then ask questions about their content.";

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
    console.log(`[DeepSeek] Enviando pregunta: "${question}" con context length: ${(context || "").length}`);
    
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
      console.error(`DeepSeek API error: ${res.status}`, text);
      return `Error calling DeepSeek API: ${res.status}. Revisa la API key o estructura del payload.`;
    }

    const data = await res.json();

    if (data.choices && data.choices[0]?.message?.content) {
      console.log(`[DeepSeek] Respuesta generada exitosamente`);
      return data.choices[0].message.content;
    }

    return JSON.stringify(data);
  } catch (err) {
    console.error("DeepSeek fetch error:", err);
    return `Error: ${err.message}. Verifica que DEEPSEEK_API_URL y DEEPSEEK_API_KEY sean correctas.`;
  }
}

export default { generateAnswer };
