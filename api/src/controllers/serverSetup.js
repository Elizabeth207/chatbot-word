// Configuración de Express y middlewares
import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
app.use(cors({
  origin: [
    "https://chatbot-word.vercel.app",
    "https://chatbot-word-2ox7uv19h-elizabeth-huarcaya-2b27d044.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://chatbot-word-production.up.railway.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());
app.use(express.json({ limit: "2mb" }));
const upload = multer({ storage: multer.memoryStorage() });

export { app, upload };
