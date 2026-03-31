let chromaClient = null;

class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.ids = [];
    this.documents = [];
    this.metadatas = [];
    this.embeddings = [];
  }

  async add({ ids = [], documents = [], metadatas = [], embeddings = [] } = {}) {
    for (let i = 0; i < ids.length; i++) {
      this.ids.push(ids[i]);
      this.documents.push(documents[i]);
      this.metadatas.push(metadatas[i]);
      this.embeddings.push(embeddings[i]);
    }
  }

  async upsert(payload) { return this.add(payload); }

  async query({ query_embeddings = [], n_results = 4, include = [] } = {}) {
    const q = query_embeddings[0];
    if (!q) return { results: [{ documents: [], metadatas: [], embeddings: [], distances: [] }] };

    const scores = this.embeddings.map((emb, idx) => {
      let dot = 0, aq = 0, ab = 0;
      for (let i = 0; i < Math.min(emb.length, q.length); i++) {
        dot += emb[i] * q[i];
        aq += q[i] * q[i];
        ab += emb[i] * emb[i];
      }
      const denom = Math.sqrt(aq) * Math.sqrt(ab) || 1e-8;
      const similarity = dot / denom;
      const distance = 1 - similarity;
      return { idx, similarity, distance };
    });

    scores.sort((a, b) => b.similarity - a.similarity);
    const top = scores.slice(0, n_results);

    return {
      results: [{
        documents: top.map(t => this.documents[t.idx]),
        metadatas: top.map(t => this.metadatas[t.idx]),
        embeddings: include.includes('embeddings') ? top.map(t => this.embeddings[t.idx]) : [],
        distances: include.includes('distances') ? top.map(t => t.distance) : [],
        ids: top.map(t => this.ids[t.idx])
      }]
    };
  }
}

const inMemoryStore = new Map();

export async function getCollection(name = "documents") {
  if (!chromaClient) {
    try {
      const mod = await import('chromadb');

      if (mod && typeof mod.ChromaClient === 'function') {
        try {
          chromaClient = new mod.ChromaClient();
        } catch (e) {
          chromaClient = mod.default ? new mod.default() : mod();
        }
      } else if (mod && typeof mod === 'function') {
        chromaClient = mod();
      }
    } catch (e) {
      chromaClient = null;
    }
  }

  if (chromaClient) {
    if (typeof chromaClient.getOrCreateCollection === 'function') {
      return await chromaClient.getOrCreateCollection(name);
    }
    if (typeof chromaClient.createCollection === 'function') {
      try { return await chromaClient.createCollection({ name }); } catch (e) {
        if (typeof chromaClient.getCollection === 'function') return await chromaClient.getCollection({ name });
      }
    }
    return chromaClient;
  }

  if (!inMemoryStore.has(name)) inMemoryStore.set(name, new InMemoryCollection(name));
  return inMemoryStore.get(name);
}

export default { getCollection };
