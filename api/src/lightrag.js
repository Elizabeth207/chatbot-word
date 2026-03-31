import { embed } from './openaiClient.js';
import { cosineSimilarity, bm25Score } from './vectorUtils.js';

const queryCache = new Map();
const CACHE_TTL = 3600000;

export async function hybridSearch(question, documents, k = 4) {
  const questionEmbedding = await embed(question);
  const questionTokens = question.toLowerCase().split(/\s+/);

  const scored = documents.map((doc, idx) => {
    const semanticScore = cosineSimilarity(questionEmbedding, doc.embedding || []);

    const lexicalScore = bm25Score(questionTokens, doc.text || '');

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

  return scored
    .sort((a, b) => b.scores.combined - a.scores.combined)
    .slice(0, k)
    .map(item => item.doc);
}

export function reRankByDiversity(documents, topK = 4) {
  if (documents.length <= topK) return documents;

  const selected = [documents[0]];
  const remaining = documents.slice(1);

  while (selected.length < topK && remaining.length > 0) {
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

export async function expandQuery(question) {
  const expanded = [question];

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

  const cacheKey = `${question}:${k}`;
  if (useCache && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Usando resultado enCaché para:', question);
      return cached.result;
    }
  }

  try {
    const questionEmbedding = await embed(question);

    let results = null;
    if (typeof collection.query === 'function') {
      results = await collection.query({
        query_embeddings: [questionEmbedding],
        n_results: k * 2,
        include: ['metadatas', 'documents', 'embeddings', 'distances']
      });
    } else if (typeof collection.getNearestMatches === 'function') {
      results = await collection.getNearestMatches(questionEmbedding, k * 2);
    } else {
      throw new Error('Chroma API not found');
    }

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
        relevanceScore: Math.max(0, 1 - (distances[idx] || 1))
      }));
    }

    if (useHybrid && documents.length > 0) {
      documents = await hybridSearch(question, documents, k);
    }

    if (rerankByDiversity) {
      documents = reRankByDiversity(documents, k);
    }

    if (useCompressContext) {
      documents = compressContext(documents, question, maxContextTokens);
    }

    documents = documents.slice(0, k);

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

export function clearCache() {
  queryCache.clear();
}

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
