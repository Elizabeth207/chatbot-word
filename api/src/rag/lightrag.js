import { embed } from "../services/openaiClient.js";

export async function lightRAGSearch(query, collection, options = {}) {
  const { k = 4, useHybrid = false, compressContext = false, maxContextTokens = 2000 } = options;

  try {
    const queryEmbedding = await embed(query);

    let results;
    if (useHybrid && typeof collection.query === "function") {
      results = await collection.query({
        query_embeddings: [queryEmbedding],
        n_results: k,
        include: ["metadatas", "documents"]
      });
    } else {
      results = await collection.query({
        query_embeddings: [queryEmbedding],
        n_results: k,
        include: ["metadatas", "documents"]
      });
    }

    if (!results?.results?.[0]?.documents) {
      return [];
    }

    const first = results.results[0];
    const documents = first.documents || [];
    const metadatas = first.metadatas || [];

    return documents.map((text, idx) => ({
      text,
      metadata: metadatas[idx] || {}
    }));
  } catch (err) {
    console.error("LightRAG search error:", err);
    throw err;
  }
}
