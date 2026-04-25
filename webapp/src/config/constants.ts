export const RAILWAY_API_URL = import.meta.env.PROD
  ? "https://chatbot-word-production.up.railway.app"
  : "http://localhost:3000";

export const STORAGE_KEY = "chatbot_conversations";
