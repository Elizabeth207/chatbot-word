/**
 * LightRAG - RAG mejorado con:
 * - Búsqueda semántica + BM25 (hybrid search)
 * - Re-ranking de resultados
 * - Compresión de contexto (solo lo relevante)
 * - Memory/caché de consultas comunes
 */

import { embed } from './openaiClient.js';
import { cosineSimilarity, bm25Score } from './vectorUtils.js';

// Cache simple de queries
const queryCache = new Map();
const CACHE_TTL = 3600000; // 1 hora

/**
 * Búsqueda híbrida (semántica + léxica)
 */
export async function hybridSearch(question, documents, k = 4) {
  // Generar embedding de la pregunta
  const questionEmbedding = await embed(question);
  const questionTokens = question.toLowerCase().split(/\s+/);
  
  // Calcular puntuaciones
  const scored = documents.map((doc, idx) => {
    // Similitud semántica (coseno)
    const semanticScore = cosineSimilarity(questionEmbedding, doc.embedding || []);
    
    // Score léxico (BM25)
    const lexicalScore = bm25Score(questionTokens, doc.text || '');
    
    // Combinar (60% semántico, 40% léxico)
    const combinedScore = semanticScore * 0.6 + lexicalScore * 0.4;
    
    return {
      idx,
      doc,
      scores: {
        semantic: semanticScore,
        lexical: lexicalScore,
        combined: combinedScore
      }
    };
  });
  
  // Ordenar y retornar top-k
  return scored
    .sort((a, b) => b.scores.combined - a.scores.combined)
    .slice(0, k)
    .map(item => item.doc);
}

/**
 * Re-ranking de resultados usando diversidad
 */
export function reRankByDiversity(documents, topK = 4) {
  if (documents.length <= topK) return documents;
  
  const selected = [documents[0]];
  const remaining = documents.slice(1);
  
  while (selected.length < topK && remaining.length > 0) {
    // Encontrar documento más diferente del set actual
    let maxMinDist = -1;
    let bestIdx = 0;
    
    remaining.forEach((doc, idx) => {
      const minDist = Math.min(
        ...selected.map(sel => jacardDistance(doc.text, sel.text))
      );
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestIdx = idx;
      }
    });
    
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  
  return selected;
}

/**
 * Comprimir contexto a solo partes relevantes
 */
export function compressContext(documents, question, maxTokens = 2000) {
  const questionTerms = question.toLowerCase().split(/\s+/);
  
  let totalTokens = 0;
  const compressed = [];
  
  for (const doc of documents) {
    const sentences = doc.text.split(/[.!?]+/).filter(s => s.trim());
    const relevantSentences = [];
    
    for (const sentence of sentences) {
      const sentenceTerms = sentence.toLowerCase().split(/\s+/);
      const matches = questionTerms.filter(term => 
        sentenceTerms.some(st => st.includes(term) || term.includes(st))
      ).length;
      
      // Si la oración contiene términos relevantes, incluirla
      if (matches >= 1) {
        relevantSentences.push(sentence.trim());
      }
    }
    
    const compressedText = relevantSentences.join('. ');
    const tokens = Math.ceil(compressedText.length / 4);
    
    if (totalTokens + tokens <= maxTokens) {
      compressed.push({
        ...doc,
        text: compressedText,
        compressed: true
      });
      totalTokens += tokens;
    }
  }
  
  return compressed;
}

/**
 * Query expansion para mejorar búsqueda
 */
export async function expandQuery(question) {
  // Genere variaciones de la pregunta
  const expanded = [question];
  
  // Expandir con sinónimos comunes
  const synonyms = {
    'qué': 'información',
    'cómo': 'procedimiento método',
    'cuándo': 'fecha tiempo',
    'dónde': 'ubicación lugar',
    'por qué': 'razón motivo causa',
    'ayuda': 'soporte asistencia',
    'error': 'problema falla',
  };
  
  for (const [key, value] of Object.entries(synonyms)) {
    if (question.toLowerCase().includes(key)) {
      expanded.push(question.replace(new RegExp(key, 'gi'), value));
    }
  }
  
  return expanded;
}

/**
 * LightRAG completo - orquesta búsqueda mejorada
 */
export async function lightRAGSearch(
  question,
  collection,
  options = {}
) {
  const {
    k = 4,
    useHybrid = true,
    rerankByDiversity = false,
    compressContext: useCompressContext = true,
    maxContextTokens = 2000,
    useCache = true
  } = options;
  
  // Revisar caché
  const cacheKey = `${question}:${k}`;
  if (useCache && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Usando resultado enCaché para:', question);
      return cached.result;
    }
  }
  
  try {
    // Generador embedding
    const questionEmbedding = await embed(question);
    
    // Búsqueda en colección vectorial
    let results = null;
    if (typeof collection.query === 'function') {
      results = await collection.query({
        query_embeddings: [questionEmbedding],
        n_results: k * 2, // Obtener más para re-ranking
        include: ['metadatas', 'documents', 'embeddings', 'distances']
      });
    } else if (typeof collection.getNearestMatches === 'function') {
      results = await collection.getNearestMatches(questionEmbedding, k * 2);
    } else {
      throw new Error('Chroma API not found');
    }
    
    // Normalizar resultados
    let documents = [];
    if (results?.results?.[0]?.documents) {
      const first = results.results[0];
      const docs = first.documents || [];
      const metadatas = first.metadatas || [];
      const embeddings = first.embeddings || [];
      const distances = first.distances || [];
      
      documents = docs.map((text, idx) => ({
        text,
        metadata: metadatas[idx],
        embedding: embeddings[idx],
        // Convertir distancia a score de relevancia (1 - distancia normalizada)
        relevanceScore: Math.max(0, 1 - (distances[idx] || 1))
      }));
    }
    
    // Aplicar filtros y mejoras
    if (useHybrid && documents.length > 0) {
      documents = await hybridSearch(question, documents, k);
    }
    
    if (rerankByDiversity) {
      documents = reRankByDiversity(documents, k);
    }
    
    if (useCompressContext) {
      documents = compressContext(documents, question, maxContextTokens);
    }
    
    // Limitar a k resultados
    documents = documents.slice(0, k);
    
    // Guardar en caché
    if (useCache) {
      queryCache.set(cacheKey, {
        result: documents,
        timestamp: Date.now()
      });
    }
    
    return documents;
  } catch (err) {
    console.error('Error en lightRAGSearch:', err);
    throw err;
  }
}

/**
 * Limpiar caché si es necesario
 */
export function clearCache() {
  queryCache.clear();
}

/**
 * Estadísticas de caché
 */
export function getCacheStats() {
  return {
    size: queryCache.size,
    maxAge: CACHE_TTL
  };
}

export default {
  hybridSearch,
  reRankByDiversity,
  compressContext,
  expandQuery,
  lightRAGSearch,
  clearCache,
  getCacheStats
};
