import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import pkg from 'pdf2pic';
const { pdf2pic } = pkg;
import fs from 'fs';
import path from 'path';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import unzipper from 'unzipper';

export async function extractFromPDF(buffer) {
  try {
    console.log(`📄 Extrayendo PDF con pdf-parse...`);
    const data = await pdf(buffer);
    let text = data.text || '';

    console.log(`   → Texto extraído: ${text.length} caracteres`);
    
    // Si el PDF tiene muy poco texto, probablemente sea escaneado
    const lineCount = text.split('\n').length;
    const meaningfulText = text.trim().replace(/\s+/g, ' ');
    
    if (meaningfulText.length < 50 && data.numpages > 0) {
      console.warn(`⚠️  PDF tiene muy poco texto seleccionable (${meaningfulText.length} chars, ${data.numpages} páginas)`);
      console.log(`🔄 Aplicando OCR a todas las páginas...`);
      text = await extractFromPDFWithOCR(buffer, data.numpages);
    }

    return text;
  } catch (err) {
    console.error('❌ Error en extractFromPDF:', err.message);
    throw new Error(`Failed to extract PDF: ${err.message}`);
  }
}

async function extractFromPDFWithOCR(buffer, numpages) {
  try {
    console.log(`🔤 Iniciando OCR con Tesseract para ${numpages} páginas...`);
    
    // Crear archivo temporal con el PDF
    const tempPdfPath = `./temp_pdf_${Date.now()}.pdf`;
    writeFileSync(tempPdfPath, buffer);
    
    try {
      // Convertir PDF a imágenes usando pdf2pic
      const options = {
        density: 200, // DPI
        saveFilename: 'page',
        savePath: './temp_images',
        format: 'png',
        width: 1024,
        height: 1024
      };
      
      console.log(`   🔄 Convirtiendo PDF a imágenes...`);
      const converter = pdf2pic(options);
      const result = await converter.bulk('-png', tempPdfPath, false);
      
      // Procesar cada imagen con OCR
      let allText = '';
      const files = fs.readdirSync('./temp_images').filter(f => f.endsWith('.png')).sort();
      
      for (let i = 0; i < files.length; i++) {
        const imgPath = path.join('./temp_images', files[i]);
        console.log(`   📖 Procesando imagen ${i + 1}/${files.length}...`);
        
        try {
          const imgBuffer = fs.readFileSync(imgPath);
          const { data: { text } } = await Tesseract.recognize(imgBuffer, 'spa+eng', {
            logger: (m) => {
              if (m.status === 'recognizing' && Math.round(m.progress * 100) % 20 === 0) {
                console.log(`      OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          });
          
          if (text && text.trim().length > 0) {
            allText += text + '\n\n---\n\n';
            console.log(`      ✓ Imagen ${i + 1}: ${text.length} caracteres`);
          }
          
          // Limpiar imagen temporal
          try { unlinkSync(imgPath); } catch (e) {}
        } catch (imgErr) {
          console.warn(`   ⚠️  Error OCR en imagen ${i + 1}: ${imgErr.message}`);
        }
      }
      
      // Limpiar carpeta temporal
      try {
        fs.rmSync('./temp_images', { recursive: true, force: true });
      } catch (e) {}
      
      if (allText.trim().length > 20) {
        console.log(`✅ OCR completado: ${allText.length} caracteres extraídos`);
        return allText;
      }
      
      console.warn(`⚠️  OCR devolvió texto muy corto: ${allText?.length || 0} caracteres`);
      return allText || 'PDF extraction with OCR produced minimal content.';
      
    } catch (convErr) {
      // Fallback si pdf2pic falla (probablemente poppler no instalado)
      console.warn(`⚠️  pdf2pic falló: ${convErr.message}`);
      console.log(`   💡 Intenta instalar poppler (Windows: descargarlo y agregarlo a PATH)`);
      return `[OCR Error] Necesita Poppler instalado para procesar este PDF. Error: ${convErr.message}`;
    } finally {
      // Limpiar archivo temporal
      try { unlinkSync(tempPdfPath); } catch (e) {}
    }
  } catch (ocrErr) {
    console.error('❌ Error en OCR:', ocrErr.message);
    return `[PDF OCR Error] ${ocrErr.message}`;
  }
}

export async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    console.error('Error en extractFromDOCX:', err);
    throw new Error(`Failed to extract DOCX: ${err.message}`);
  }
}

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

export async function extractFromImage(buffer, filename = '') {
  try {
    console.log(`🔤 Extrayendo texto de imagen con OCR: ${filename}`);

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

export async function extractTextFromFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimetype = filename.split('.').pop().toLowerCase();

  console.log(`\n📥 Extrayendo texto de: ${filename} (tipo: ${ext})`);

  try {
    let extractedText = '';

    if (ext === '.pdf' || mimetype === 'pdf') {
      extractedText = await extractFromPDF(buffer);
    } else if (ext === '.docx' || mimetype === 'docx') {
      extractedText = await extractFromDOCX(buffer);
    } else if (ext === '.doc') {
      extractedText = await extractFromDOCX(buffer);
    } else if (ext === '.xlsx' || ext === '.xls') {
      extractedText = await extractFromXLSX(buffer);
    } else if (ext === '.pptx' || ext === '.ppt') {
      extractedText = await extractFromPPTX(buffer);
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      extractedText = await extractFromImage(buffer, filename);
    } else if (['.txt', '.md', '.markdown'].includes(ext)) {
      extractedText = buffer.toString('utf-8');
    } else {
      extractedText = buffer.toString('utf-8');
    }

    // Validar que tenemos contenido útil
    const cleanText = extractedText.trim();
    const meaningfulLength = cleanText.replace(/\s+/g, ' ').length;

    if (!cleanText || meaningfulLength < 20) {
      console.error(`❌ El archivo devolvió contenido muy corto: ${meaningfulLength} caracteres útiles`);
      throw new Error(`File extraction failed or returned empty content for ${filename}. Got only ${meaningfulLength} meaningful characters.`);
    }

    console.log(`✅ Extracción exitosa: ${extractedText.length} caracteres, ${meaningfulLength} caracteres útiles\n`);
    return extractedText;
  } catch (err) {
    console.error(`❌ Error extrayendo texto de ${filename}:`, err.message);
    throw err;
  }
}

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
