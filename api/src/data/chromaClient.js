// Almacenamiento en memoria (sin ChromaDB externo)
const inMemoryStore = {
  documents: new Map(),
  embeddings: new Map(),
  metadatas: new Map()
};

// Similitud de coseno
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getCollection(collectionName = "documents") {
  // Retornar un wrapper que simula la interfaz de ChromaDB
  return {
    name: collectionName,
    add: async ({ ids, documents, metadatas, embeddings }) => {
      for (let i = 0; i < ids.length; i++) {
        inMemoryStore.documents.set(ids[i], documents[i]);
        inMemoryStore.embeddings.set(ids[i], embeddings[i]);
        inMemoryStore.metadatas.set(ids[i], metadatas[i]);
      }
      console.log(`✅ Indexed ${ids.length} documents in memory`);
    },
    upsert: async ({ ids, documents, metadatas, embeddings }) => {
      for (let i = 0; i < ids.length; i++) {
        inMemoryStore.documents.set(ids[i], documents[i]);
        inMemoryStore.embeddings.set(ids[i], embeddings[i]);
        inMemoryStore.metadatas.set(ids[i], metadatas[i]);
      }
      console.log(`✅ Upserted ${ids.length} documents in memory`);
    },
    query: async ({ query_embeddings, n_results }) => {
      const results = { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
      if (!query_embeddings || query_embeddings.length === 0) return { results };
      
      const queryEmb = query_embeddings[0];
      const docs = [];
      
      for (const [id, emb] of inMemoryStore.embeddings) {
        if (emb && emb.length > 0) {
          const similarity = cosineSimilarity(queryEmb, emb);
          docs.push({ id, similarity, text: inMemoryStore.documents.get(id), metadata: inMemoryStore.metadatas.get(id) });
        }
      }
      
      docs.sort((a, b) => b.similarity - a.similarity);
      const topDocs = docs.slice(0, n_results || 4);
      
      results.ids = [topDocs.map(d => d.id)];
      results.documents = [topDocs.map(d => d.text)];
      results.metadatas = [topDocs.map(d => d.metadata)];
      results.distances = [topDocs.map(d => 1 - d.similarity)];
      
      return { results };
    },
    get: async () => {
      const ids = Array.from(inMemoryStore.documents.keys());
      return {
        ids,
        documents: ids.map(id => inMemoryStore.documents.get(id)),
        embeddings: ids.map(id => inMemoryStore.embeddings.get(id)),
        metadatas: ids.map(id => inMemoryStore.metadatas.get(id))
      };
    }
  };
}

export default { getCollection };
