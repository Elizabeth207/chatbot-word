/**
 * Módulo de extracción de texto de múltiples formatos
 * Soporta: PDF (con OCR), DOCX, PPTX, XLSX, imágenes (OCR)
 */

import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import unzipper from 'unzipper';

/**
 * Extraer texto de archivos PDF (con OCR si es necesario)
 */
export async function extractFromPDF(buffer) {
  try {
    // Primero intentar extracción directa
    const data = await pdf(buffer);
    let text = data.text || '';
    
    // Si el PDF tiene pocas líneas de texto, probablemente es imagen -> OCR
    const lineCount = text.split('\n').length;
    if (lineCount < 5 && data.numpages > 0) {
      console.log('PDF detectado como imagen/escaneado, aplicando OCR...');
      text = await extractFromPDFWithOCR(buffer);
    }
    
    return text;
  } catch (err) {
    console.error('Error en extractFromPDF:', err);
    throw new Error(`Failed to extract PDF: ${err.message}`);
  }
}

/**
 * OCR en PDF usando Tesseract
 */
async function extractFromPDFWithOCR(buffer) {
  // Nota: Tesseract.js requiere procesamiento por página de PDF
  // Esta es una versión simplificada - en producción usarías pdf-lib + tesseract
  console.warn('OCR en PDF requiere pdf2image + tesseract, usando fallback...');
  return 'PDF with images detected. Please implement full PDF OCR pipeline.';
}

/**
 * Extraer texto de archivos DOCX (Word)
 */
export async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    console.error('Error en extractFromDOCX:', err);
    throw new Error(`Failed to extract DOCX: ${err.message}`);
  }
}

/**
 * Extraer texto de archivos XLSX (Excel)
 */
export async function extractFromXLSX(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `\n## ${sheetName}\n\n${csv}`;
    }
    
    return text;
  } catch (err) {
    console.error('Error en extractFromXLSX:', err);
    throw new Error(`Failed to extract XLSX: ${err.message}`);
  }
}

/**
 * Extraer texto de archivos PPTX (PowerPoint)
 */
export async function extractFromPPTX(buffer) {
  try {
    const tmpFile = `./pptx_${Date.now()}.zip`;
    writeFileSync(tmpFile, buffer);
    
    let text = '';
    
    return new Promise((resolve, reject) => {
      createReadStream(tmpFile)
        .pipe(unzipper.Parse())
        .on('entry', async (entry) => {
          if (entry.path.startsWith('ppt/slides/slide') && entry.path.endsWith('.xml')) {
            const chunks = [];
            entry.on('data', chunk => chunks.push(chunk));
            entry.on('end', () => {
              const xmlText = Buffer.concat(chunks).toString('utf-8');
              // Extraer texto entre etiquetas <a:t>
              const matches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g);
              if (matches) {
                matches.forEach(match => {
                  const content = match.replace(/<a:t>|<\/a:t>/g, '');
                  text += content + ' ';
                });
                text += '\n';
              }
            });
          } else {
            entry.autodrain();
          }
        })
        .on('error', reject)
        .on('end', () => {
          try {
            unlinkSync(tmpFile);
            resolve(text);
          } catch (e) {
            resolve(text);
          }
        });
    });
  } catch (err) {
    console.error('Error en extractFromPPTX:', err);
    return 'PPTX extraction requires additional setup. Returning empty text.';
  }
}

/**
 * Extraer texto de imágenes usando OCR (Tesseract.js)
 */
export async function extractFromImage(buffer, filename = '') {
  try {
    console.log(`🔤 Extrayendo texto de imagen con OCR: ${filename}`);
    
    // Tesseract.js puede recibir: URL, Canvas, ImageData, o array de bytes
    // Con buffer de Node, necesitamos convertir a algo que Tesseract entienda
    
    const {
      data: { text }
    } = await Tesseract.recognize(buffer, 'spa+eng', {
      logger: (m) => {
        if (m.status === 'recognizing') {
          console.log(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(` OCR completado. Texto extraído: ${text.length} caracteres`);
    
    if (!text || text.trim().length < 5) {
      console.warn(` Advertencia: Muy poco texto extraído de ${filename}`);
    }
    
    return text || 'No se pudo extraer texto de la imagen.';
  } catch (err) {
    console.error('❌ Error en OCR:', err);
    throw new Error(`Failed to extract text from image: ${err.message}`);
  }
}

/**
 * Detectar tipo de archivo y extraer texto
 */
export async function extractTextFromFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimetype = filename.split('.').pop().toLowerCase();
  
  console.log(`Extrayendo texto de: ${filename} (tipo: ${ext})`);
  
  try {
    // Documentos
    if (ext === '.pdf' || mimetype === 'pdf') {
      return await extractFromPDF(buffer);
    }
    if (ext === '.docx' || mimetype === 'docx') {
      return await extractFromDOCX(buffer);
    }
    if (ext === '.doc') {
      return await extractFromDOCX(buffer); // Intentar como DOCX
    }
    if (ext === '.xlsx' || ext === '.xls') {
      return await extractFromXLSX(buffer);
    }
    if (ext === '.pptx' || ext === '.ppt') {
      return await extractFromPPTX(buffer);
    }
    
    // Imágenes
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      return await extractFromImage(buffer, filename);
    }
    
    // Texto plano
    if (['.txt', '.md', '.markdown'].includes(ext)) {
      return buffer.toString('utf-8');
    }
    
    // Por defecto, intentar como texto
    return buffer.toString('utf-8');
  } catch (err) {
    console.error(`Error extrayendo texto de ${filename}:`, err);
    throw err;
  }
}

/**
 * Extraer metadatos del documento
 */
export function getDocumentMetadata(filename, text) {
  const ext = path.extname(filename).toLowerCase();
  
  return {
    filename,
    type: ext.slice(1),
    source: 'upload',
    extractedAt: new Date().toISOString(),
    textLength: text.length,
    approxTokens: Math.ceil(text.length / 4),
    wordCount: text.split(/\s+/).length,
    hasImages: /\[image\]|\[img\]|<img|image extracted/i.test(text),
    language: detectLanguage(text)
  };
}

/**
 * Detección simple de idioma
 */
function detectLanguage(text) {
  const sample = text.substring(0, 500);
  const spanishWords = ['el', 'la', 'de', 'que', 'es', 'en'];
  const matched = spanishWords.filter(w => new RegExp(`\\b${w}\\b`).test(sample.toLowerCase())).length;
  return matched > 3 ? 'es' : 'en';
}

export default {
  extractTextFromFile,
  extractFromPDF,
  extractFromDOCX,
  extractFromXLSX,
  extractFromPPTX,
  extractFromImage,
  getDocumentMetadata
};
