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
    console.log(`[${this.name}] Agregando ${ids.length} documentos`);
    for (let i = 0; i < ids.length; i++) {
      this.ids.push(ids[i]);
      this.documents.push(documents[i]);
      this.metadatas.push(metadatas[i]);
      this.embeddings.push(embeddings[i]);
    }
    console.log(`[${this.name}] Total de documentos ahora: ${this.ids.length}`);
  }

  async upsert(payload) { 
    const { ids = [] } = payload;
    // Remover documentos con los mismos IDs
    ids.forEach(id => {
      const idx = this.ids.indexOf(id);
      if (idx !== -1) {
        this.ids.splice(idx, 1);
        this.documents.splice(idx, 1);
        this.metadatas.splice(idx, 1);
        this.embeddings.splice(idx, 1);
      }
    });
    return this.add(payload);
  }

  async query({ query_embeddings = [], n_results = 4, include = [] } = {}) {
    const q = query_embeddings[0];
    if (!q || !Array.isArray(q) || q.length === 0) {
      console.warn(`[${this.name}] Query embedding inválido`);
      return { results: [{ documents: [], metadatas: [], embeddings: [], distances: [], ids: [] }] };
    }

    if (this.embeddings.length === 0) {
      console.warn(`[${this.name}] No hay documentos indexados`);
      return { results: [{ documents: [], metadatas: [], embeddings: [], distances: [], ids: [] }] };
    }

    const scores = this.embeddings.map((emb, idx) => {
      if (!emb || !Array.isArray(emb) || emb.length === 0) {
        return { idx, similarity: 0, distance: 1 };
      }
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
    const top = scores.slice(0, Math.min(n_results, scores.length));

    console.log(`[${this.name}] Query búsqueda retorna ${top.length} resultados`);

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

  async get() {
    return {
      ids: this.ids,
      documents: this.documents,
      metadatas: this.metadatas,
      embeddings: this.embeddings
    };
  }
}

const inMemoryStore = new Map();

export async function getCollection(name = "documents") {
  if (!inMemoryStore.has(name)) {
    inMemoryStore.set(name, new InMemoryCollection(name));
  }
  return inMemoryStore.get(name);
}

export default { getCollection };
