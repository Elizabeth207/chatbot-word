# CHATBOT (RAG) - API

Pasos rápidos para ejecutar el backend (Node + Express):

- Copia `api/.env.example` a `api/.env` y rellena `OPENAI_API_KEY`, `DEEPSEEK_API_URL` y `DEEPSEEK_API_KEY`.
- Desde `e:/chatbot-rag/api` instala dependencias:

```bash
npm install
```

- Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

Endpoints principales:

- `POST /ingest` : Ingesta documentos en la colección Chroma.
  - Body JSON: `{ documents: [{ id, text, metadata }] }`
- `POST /query` : Realiza búsqueda semántica y genera respuesta con DeepSeek.
  - Body JSON: `{ question: "...", k: 4 }`

Notas:
- Este backend usa la API de OpenAI para embeddings y una colección Chroma local.
- El wrapper de DeepSeek espera que `DEEPSEEK_API_URL` reciba `{ context, question }` y devuelva `{ answer }` o similar.
