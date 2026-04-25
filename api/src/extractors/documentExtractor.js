import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import Tesseract from "tesseract.js";
import unzipper from "unzipper";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const envLines = envContent.split("\n");
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

function sniffKind(buffer) {
  if (buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "zipish";
  return null;
}

async function extractTextFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || "").trim();
}

async function extractTextFromDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return (value || "").trim();
}

function extractTextFromSpreadsheet(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (sheet) {
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) parts.push(`[${name}]\n${csv}`);
    }
  }
  return parts.join("\n\n").trim();
}

async function extractTextFromPptx(buffer) {
  const directory = await unzipper.Open.buffer(buffer);
  const parts = [];
  for (const file of directory.files) {
    if (!/ppt\/slides\/slide\d+\.xml$/i.test(file.path)) continue;
    const content = (await file.buffer()).toString("utf8");
    const text = content
      .replace(/<a:[^>]*>[^<]*<\/a:[^>]*>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) parts.push(text);
  }
  return parts.join("\n\n").trim();
}

async function extractTextFromUnknownZipBuffer(buffer) {
  let docxT = "";
  try {
    docxT = await extractTextFromDocx(buffer);
  } catch {
    /* not docx */
  }
  if (docxT) return docxT;
  const xlsxT = extractTextFromSpreadsheet(buffer);
  if (xlsxT) return xlsxT;
  const pptxT = await extractTextFromPptx(buffer);
  if (pptxT) return pptxT;
  return "";
}

async function extractTextFromDocumentBuffer(buffer, ext, originalname) {
  const e = (ext || "").toLowerCase();
  const kind = sniffKind(buffer);

  if (kind === "pdf" || e === ".pdf") {
    const t = await extractTextFromPdf(buffer);
    if (!t) throw new Error("No se pudo extraer texto del PDF (¿escaneado vacío o protegido?).");
    return t;
  }
  if (e === ".docx") {
    return (await extractTextFromDocx(buffer)) || "";
  }
  if (e === ".doc") {
    if (buffer.length >= 2 && buffer[0] === 0xd0 && buffer[1] === 0xcf) {
      throw new Error("El formato .doc (Word 97-2003) no está soportado. Convierte a .docx o PDF.");
    }
    try {
      return (await extractTextFromDocx(buffer)) || "";
    } catch {
      throw new Error("No se pudo leer el archivo. Usa .docx o exporta a PDF.");
    }
  }
  if (e === ".xlsx" || e === ".xls" || e === ".csv") {
    return extractTextFromSpreadsheet(buffer);
  }
  if (e === ".pptx") {
    return (await extractTextFromPptx(buffer)) || "";
  }
  if (e === ".ppt") {
    throw new Error("Los archivos .ppt antiguos no están soportados. Usa .pptx o PDF.");
  }
  if (e === ".txt" || e === ".md" || e === ".json" || e === ".rtf" || e === ".log") {
    return buffer.toString("utf8").trim();
  }
  if (kind === "zipish" && (e === "" || !e)) {
    const t = await extractTextFromUnknownZipBuffer(buffer);
    if (t) return t;
  }
  const asUtf8 = buffer.toString("utf8");
  if (
    asUtf8.length > 20 &&
    /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(asUtf8) &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(asUtf8.slice(0, 200))
  ) {
    return asUtf8.trim();
  }
  throw new Error(`No hay extractor para "${originalname || e || "archivo"}". Usa PDF, DOCX, XLSX, PPTX o TXT.`);
}

function getMimeType(ext) {
  const mimeTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };
  return mimeTypes[ext] || "image/png";
}

async function extractTextFromImageWithVision(buffer, mimeType) {
  const base64Image = buffer.toString("base64");
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrae todo el texto visible en esta imagen. Si no hay texto, describe brevemente qué se muestra en la imagen.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 2000,
      });
      const t = response.choices[0]?.message?.content;
      if (t) return t;
    } catch {
      /* try fallbacks */
    }
  }
  if (DEEPSEEK_API_KEY) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extrae todo el texto visible en esta imagen. Si no hay texto, describe brevemente qué se muestra en la imagen.",
                },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
              ],
            },
          ],
          max_tokens: 2000,
        }),
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    } catch {
      /* groq or tesseract */
    }
  }
  if (GROQ_API_KEY) {
    try {
      const groqClient = new OpenAI({ apiKey: GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
      const response = await groqClient.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extrae todo el texto visible en esta imagen." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        max_tokens: 2000,
      });
      const t = response.choices[0]?.message?.content;
      if (t) return t;
    } catch {
      /* tesseract */
    }
  }
  const {
    data: { text: ocrText },
  } = await Tesseract.recognize(buffer, "spa+eng", { logger: () => {} });
  if (ocrText && ocrText.trim()) return ocrText.trim();
  throw new Error("No se pudo extraer texto de la imagen (vision/OCR). Comprueba OPENAI_API_KEY o prueba otra imagen.");
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} [mimeType] from multer (e.g. image/png without filename extension)
 */
export async function extractTextFromFile(buffer, filename, mimeType = "") {
  const ext = path.extname(filename).toLowerCase();
  const isImage =
    /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(ext) ||
    (typeof mimeType === "string" && mimeType.toLowerCase().startsWith("image/"));

  if (isImage) {
    const mt = (mimeType && mimeType.split(";")[0].trim()) || getMimeType(ext) || "image/png";
    return extractTextFromImageWithVision(buffer, mt);
  }
  return extractTextFromDocumentBuffer(buffer, ext, filename);
}

export function getDocumentMetadata(filename, text) {
  const ext = path.extname(filename).toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(ext);
  return {
    filename,
    extension: ext,
    type: isImage ? "image" : "document",
    length: text?.length || 0,
    uploadedAt: new Date().toISOString(),
  };
}
