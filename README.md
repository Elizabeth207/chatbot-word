# CHATBOT (RAG)

Proyecto dividido en dos carpetas principales:

- `api/` : Backend Node.js + Express encargado de embeddings (OpenAI), vectorstore (Chroma) y orquestación RAG con DeepSeek.
- `webapp/` : Frontend React + Vite con una interfaz de chat simple que consume el endpoint `/query`.

Pasos rápidos:

1. Backend

```bash
cd api
npm install
cp .env.example .env
# Rellena variables en .env
npm run dev
```

2. Frontend

```bash
cd webapp
npm install
npm run dev
```

3. Ingesta de documentos (ejemplo):

```bash
curl -X POST http://localhost:3000/ingest -H "Content-Type: application/json" -d "{ \"documents\": [{\"id\": \"doc1\", \"text\": \"Texto de ejemplo...\"}]}"
```

4. Consulta (ejemplo):

```bash
curl -X POST http://localhost:3000/query -H "Content-Type: application/json" -d "{ \"question\": \"¿Cuál es la info clave?\" }"
```

---

### Pruebas sin gastar créditos

- Si dejas `OPENAI_API_KEY` vacío o configuras un valor que empiece por `mock`, el servidor generará embeddings de prueba internamente en lugar de llamar a OpenAI.
- Si `DEEPSEEK_API_URL` está vacío devolverá una respuesta simulada (`SIMULATED ANSWER`) con el contexto; no se llamará al servicio real.
- Puedes iterar sobre la UI y el backend usando datos inventados para verificar el flujo antes de utilizar tus llaves.

### Ingestar archivos locales

Para facilitar pruebas con tu propio contenido creé un script en `api/scripts/ingestSample.js` que recorre un directorio buscando archivos Markdown y los sube a la colección.

```bash
cd api
node scripts/ingestSample.js ../docs
```

El directorio puede contener cualquier `.md`; el identificador del documento será el nombre de archivo. Esto te permite poblar el store con contenido real sin escribir JSON a mano.

Si quieres, continúo con:
- Ajustar la integración con LangChain JS (si quieres usar sus utilidades). **Ya está configurado: los embeddings pasan por LangChain.**
- Añadir manejo por lotes de embeddings y cargas masivas de documentos.
- Preparar un script de ingestión desde archivos locales.
