// Respuestas conversacionales
function getConversationalResponse(message) {
  const responses = {
    "gracias": "¡Con gusto! Si necesitas más ayuda con el documento, dime.",
    "thanks": "You're welcome! If you need more help with the document, let me know.",
    "ok": "¡Perfecto! ¿Hay algo más en lo que pueda ayudarte?",
    "vale": "¡Genial! ¿Necesitas algo más?",
    "perfecto": "¡Excelente! ¿Qué más puedo hacer por ti?",
    "listo": "¡Listo! ¿Hay algo más que quieras consultar?",
    "hola": "¡Hola! ¿En qué puedo ayudarte hoy?",
    "buenas": "¡Buenas! ¿Cómo puedo asistirte?",
    "adiós": "¡Hasta luego! Que tengas un buen día.",
    "bye": "¡Adiós! Nos vemos pronto."
  };
  const msg = message.toLowerCase().trim();
  for (const [key, response] of Object.entries(responses)) {
    if (msg.includes(key)) {
      return response;
    }
  }
  return "¡Entendido! Si tienes alguna pregunta sobre el documento, estoy aquí para ayudar.";
}

export { getConversationalResponse };
