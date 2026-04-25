// Detección de intención y helpers
function detectIntent(message) {
  const conversationalKeywords = [
    "gracias", "ok", "vale", "perfecto", "listo", "thanks", "hola", "buenas",
    "buenos días", "buenas tardes", "buenas noches", "adiós", "bye", "chau",
    "entendido", "claro", "sí", "no", "por favor", "disculpa", "perdón"
  ];
  const extractionKeywords = [
    "extrae", "extract", "texto", "text", "ocr", "lee", "read", "palabras", "words",
    "sólo", "solo", "devuelve", "return", "muestra", "show"
  ];
  const msg = message.toLowerCase().trim();
  if (msg.split(' ').length <= 3 && conversationalKeywords.some(keyword => msg.includes(keyword))) {
    return "conversation";
  }
  const hasExtraction = extractionKeywords.some(keyword => msg.includes(keyword));
  const hasImageWords = msg.includes("imagen") || msg.includes("image") || msg.includes("foto") || msg.includes("photo");
  if (hasExtraction && hasImageWords) {
    return "extract_image_text";
  }
  const hasPdfWords = msg.includes("pdf") || msg.includes("documento") || msg.includes("doc") || msg.includes("archivo");
  if (hasExtraction && hasPdfWords) {
    return "extract_pdf_text";
  }
  return "query";
}

function isGeneralQuery(question) {
  const generalKeywords = [
    "qué es", "cómo", "explica", "define", "qué significa", "por qué", "cuándo", "dónde", "quién",
    "qué son", "cómo funciona", "qué hace", "dime", "cuéntame", "habla", "describe"
  ];
  const documentKeywords = ["documento", "pdf", "archivo", "texto", "contenido", "página"];
  const lower = question.toLowerCase();
  const hasGeneral = generalKeywords.some(k => lower.includes(k));
  const hasDocument = documentKeywords.some(k => lower.includes(k));
  return hasGeneral && !hasDocument;
}

export { detectIntent, isGeneralQuery };
