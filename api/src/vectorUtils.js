export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
    return 0;
  }

  const minLen = Math.min(vec1.length, vec2.length);
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < minLen; i++) {
    dotProduct += vec1[i] * vec1[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

export function bm25Score(queryTerms, document, k1 = 1.5, b = 0.75, avgDocLen = 200) {
  const docTerms = document.toLowerCase().split(/\s+/);
  const docLen = docTerms.length;
  let score = 0;

  const idf = new Map();
  queryTerms.forEach(term => {
    const matches = docTerms.filter(dt => dt.includes(term)).length;
    idf.set(term, Math.log(1 + matches + 1));
  });

  for (const term of queryTerms) {
    const tf = (docTerms.filter(dt => dt.includes(term)).length || 0) / docLen;
    const idfValue = idf.get(term) || 0;

    const numerator = idfValue * tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));

    score += numerator / denominator;
  }

  return Math.min(1, score / queryTerms.length);
}

export function jacardDistance(text1, text2) {
  const set1 = new Set(text1.toLowerCase().split(/\s+/));
  const set2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

export function euclideanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }

  return Math.sqrt(sum);
}

export function manhattanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.abs(vec1[i] - vec2[i]);
  }

  return sum;
}

/**
 * Normalizar vector (llevar a magnitud 1)
 */
export function normalizeVector(vec) {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vec.map(val => val / magnitude) : vec;
}

/**
 * Centroide de múltiples vectores
 */
export function centroid(vectors) {
  if (!vectors || vectors.length === 0) return [];
  
  const dim = vectors[0].length;
  const center = new Array(dim).fill(0);
  
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      center[i] += (vec[i] || 0) / vectors.length;
    }
  }
  
  return center;
}

export default {
  cosineSimilarity,
  bm25Score,
  jacardDistance,
  euclideanDistance,
  manhattanDistance,
  normalizeVector,
  centroid
};
