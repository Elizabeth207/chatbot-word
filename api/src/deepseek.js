
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export async function generateAnswer(context, question) {

  if (!DEEPSEEK_API_KEY) {
  
    const ctx = (context || "").replace(/\r/g, "\n");
    const preview = ctx.slice(0, 500);
    return `MOCK ANSWER: No hay DEEPSEEK_API_KEY configurada.\nPregunta: ${question}\nContexto: ${preview}...\n\nConfigura DEEPSEEK_API_KEY en .env para respuestas reales.`;
  }

 
  const systemPrompt = context 
    ? `You are a helpful AI assistant. Use the following context to answer questions accurately. If the context is not relevant or insufficient, supplement with your general knowledge. Respond in the same language as the question. Use markdown formatting for better readability.\n\nContext:\n${context}`
    : "You are a helpful AI assistant. Answer questions accurately and comprehensively. Respond in the same language as the question. Use markdown formatting when appropriate.";

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
      console.error(`DeepSeek API error: ${res.status}`, text);
      return `Error calling DeepSeek API: ${res.status}. Revisa la API key o estructura del payload.`;
    }

    const data = await res.json();
    
   
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
  
    return JSON.stringify(data);
  } catch (err) {
    console.error("DeepSeek fetch error:", err);
    return `Error: ${err.message}. Verifica que DEEPSEEK_API_URL y DEEPSEEK_API_KEY sean correctas.`;
  }
}

export default { generateAnswer };
