# Chatbot (RAG) — API

Backend **Node.js + Express**: extracción de texto (PDF, Office, imágenes), embeddings, RAG y respuestas en streaming.

## Arranque

```bash
cd api
npm install
cp .env.example .env
```

Edita `api/.env` (por ejemplo `OPENAI_API_KEY`). Arranca:

```bash
npm run dev
```

El servidor escucha en el puerto definido por `PORT` (por defecto **3000**).

## Rutas principales

| Método | Ruta | Descripción |
|--------|------|--------------|
| `POST` | `/ingest` | Ingesta de documentos JSON |
| `POST` | `/query` | Pregunta con RAG (respuesta SSE) |
| `POST` | `/query/stream` | Variante streaming del query |
| `POST` | `/upload` | Subida de archivo (`multipart`, campo `file`) |
| `POST` | `/query-multimodal` | Archivo + pregunta (`multipart`, campo `image`) |
| `GET` | `/debug/docs` | Depuración de documentos indexados |

## Script de ejemplo

Para indexar `.md` desde una carpeta:

```bash
cd api
node scripts/ingestSample.js ../ruta/a/tus/archivos
```

## Notas

- Sin `OPENAI_API_KEY` válida, los embeddings pueden usar un modo simulado según la lógica de `openaiClient.js`.
- Variables sensibles: no subas `.env` al repositorio.
