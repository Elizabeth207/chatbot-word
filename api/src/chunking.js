/**
 * Módulo de chunking dinámico
 * Divide texto en chunks preservando contexto y contando tokens
 * aproximadamente 1 token ≈ 4 caracteres
 */

const TOKENS_PER_CHUNK = 512; // ~2048 caracteres por chunk
const OVERLAP_TOKENS = 50; // ~200 caracteres de overlap para contexto
const SENTENCES_BUFFER = 2; // mantener 2 oraciones de contexto

// Estimación simple de tokens (1 token ≈ 4 caracteres)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Dividir por oraciones preservando puntuación
function splitBySentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim());
}

// Split por párrafos
function splitByParagraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim());
}

/**
 * Chunking dinámico que preserva contexto y estructura
 * @param {string} text - Texto a dividir
 * @param {number} maxTokens - Tokens máximos por chunk (default 512)
 * @returns {Array<{text: string, tokens: number, startChar: number, endChar: number}>}
 */
export function chunkText(text, maxTokens = TOKENS_PER_CHUNK) {
  if (!text || !text.trim()) return [];

  const chunks = [];
  let currentChunk = '';
  let chunkStartChar = 0;
  
  // Primero intentar dividir por párrafos
  const paragraphs = splitByParagraphs(text);
  
  for (const paragraph of paragraphs) {
    // Luego dividir párrafos por oraciones
    const sentences = splitBySentences(paragraph);
    
    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);
      const currentTokens = estimateTokens(currentChunk);
      
      // Si agregar esta oración excede el límite
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.trim()) {
        // Guardar chunk actual
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length
        });
        
        // Iniciar nuevo chunk con overlap (últimas 2 oraciones del chunk anterior)
        const previousSentences = splitBySentences(currentChunk);
        const overlapSentences = previousSentences.slice(-SENTENCES_BUFFER).join(' ');
        currentChunk = overlapSentences + ' ' + sentence;
        chunkStartChar += currentChunk.length;
      } else {
        currentChunk += (currentChunk.trim() ? ' ' : '') + sentence.trim();
      }
    }
  }
  
  // Guardar último chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      tokens: estimateTokens(currentChunk),
      startChar: chunkStartChar,
      endChar: chunkStartChar + currentChunk.length
    });
  }
  
  return chunks;
}

/**
 * Chunking avanzado con análisis de contexto semántico
 * Identifica secciones, títulos y mantiene coherencia
 */
export function smartChunk(text, maxTokens = TOKENS_PER_CHUNK) {
  if (!text || !text.trim()) return [];
  
  const chunks = [];
  const sections = text.split(/^#+\s+/m); // Dividir por headers Markdown
  
  let globalChunkIndex = 0;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    // Si la sección es pequeña, mantenerla como unidad
    const sectionTokens = estimateTokens(section);
    if (sectionTokens <= maxTokens) {
      chunks.push({
        text: section,
        tokens: sectionTokens,
        section: i > 0 ? `Section ${i}` : 'Introduction',
        chunkIndex: globalChunkIndex++,
        startChar: text.indexOf(section),
        endChar: text.indexOf(section) + section.length
      });
      continue;
    }
    
    // Si es más grande, subdividicar por párrafos
    const paragraphs = section.split(/\n\n+/).filter(p => p.trim());
    let currentChunk = '';
    
    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);
      const currentTokens = estimateTokens(currentChunk);
      
      if (currentTokens + paraTokens > maxTokens && currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: globalChunkIndex++,
          startChar: text.indexOf(currentChunk),
          endChar: text.indexOf(currentChunk) + currentChunk.length
        });
        currentChunk = para;
      } else {
        currentChunk += (currentChunk.trim() ? '\n\n' : '') + para;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        tokens: estimateTokens(currentChunk),
        chunkIndex: globalChunkIndex++,
        startChar: text.indexOf(currentChunk),
        endChar: text.indexOf(currentChunk) + currentChunk.length
      });
    }
  }
  
  return chunks;
}

/**
 * Fusionar chunks pequeños para optimizar
 */
export function mergeSmallChunks(chunks, minTokens = 100) {
  if (!chunks.length) return chunks;
  
  const merged = [];
  let current = chunks[0];
  
  for (let i = 1; i < chunks.length; i++) {
    const nextChunk = chunks[i];
    const combinedTokens = current.tokens + nextChunk.tokens;
    
    // Si combinado no excede límite y es pequeño, fusionar
    if (combinedTokens <= TOKENS_PER_CHUNK && current.tokens < minTokens) {
      current = {
        ...current,
        text: current.text + '\n\n' + nextChunk.text,
        tokens: combinedTokens,
        endChar: nextChunk.endChar
      };
    } else {
      merged.push(current);
      current = nextChunk;
    }
  }
  
  merged.push(current);
  return merged;
}

export default {
  chunkText,
  smartChunk,
  mergeSmallChunks,
  estimateTokens
};
