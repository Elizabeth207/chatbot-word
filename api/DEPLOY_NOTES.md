# Fix para Bug de Carga de Documentos RAG

## Problema Identificado

Cuando se suben documentos (PDF, DOCX, etc.), se extrae el texto pero las consultas posteriores devuelven "No se encontró información relevante".

## Causas

1. **Flujo de sesión**: El `sessionId` debe mantener los archivos activos entre `/upload` y `/query`
2. **Indexación en ChromaDB**: Los documentos se guardan pero quizás no se recuperan correctamente
3. **Embeddings inválidos**: El embedding vector podría no estar siendo calculado o almacenado correctamente

## Cambios Implementados

### 1. **Backend - `/upload` (index.js)**
✅ Ahora valida que:
- El texto se extrae correctamente
- El embedding se genera sin errores
- El documento se indexa en ChromaDB correctamente
- El documento se guarda en `sessionState` como **documento activo**

✅ Logging mejorado:
```
📁 [/upload] Procesando archivo: ...
✅ Extracción completada: X caracteres
⚙️  Generando embedding para búsqueda...
✅ Embedding generado: 1536 dimensiones
📊 Indexando en ChromaDB...
✅ Documento indexado en colección
📄 Documento activo: PDF/DOCUMENTO
✅ [/upload] Completado exitosamente
```

### 2. **Backend - `/query` (index.js)**
✅ Prioriza documento activo:
```javascript
if (sessionState.activeDocument === 'pdf' && sessionState.lastPdfContent) {
  // USAR DOCUMENTO ACTIVO DIRECTAMENTE
  // No buscar en ChromaDB, usar el que está en memoria
  await generateStreamingMarkdownResponse(pdfContext, question, ...);
}
```

✅ Logging mejorado para debug:
```
🔍 [/query] Nueva pregunta: "..."
📊 Estado de sesión: activeDocument = pdf
✅ Usando documento ACTIVO de sesión: PDF
📚 Contexto armado: X caracteres, Y documentos
✅ Respuesta completada
```

### 3. **Debug Endpoint - `/debug/docs`**
✅ Muestra documentos indexados:
- Cantidad total
- Tamaño de texto
- Preview de contenido
- Longitud del embedding
- Metadata

## Cómo Verificar el Fix

### En el Terminal (Backend)

Después de subir un PDF, deberías ver:
```
📁 [/upload] Procesando archivo: contrato.pdf (1258400 bytes)
✅ Extracción completada: 45000 caracteres
⚙️  Generando embedding para búsqueda...
✅ Embedding generado: 1536 dimensiones
📊 Indexando en ChromaDB...
✅ Documento indexado en colección
📄 Documento activo: PDF/DOCUMENTO
✅ [/upload] Completado exitosamente
```

Cuando haces una pregunta:
```
🔍 [/query] Nueva pregunta: "¿Qué información contiene?"
📊 Estado de sesión: activeDocument = pdf
✅ Usando documento ACTIVO de sesión: PDF
📚 Contexto armado: 45000 caracteres, 1 documentos
✅ Respuesta completada
```

### En el Frontend

1. Sube un PDF
2. Haz una pregunta específica sobre el contenido
3. **Esperado**: La respuesta incluye información del PDF

### Con Curl

```bash
# Ver documentos indexados
curl http://localhost:3000/debug/docs

# Respuesta esperada:
{
  "source": "in-memory",
  "count": 1,
  "totalChars": 45000,
  "data": [
    {
      "id": "contrato.pdf",
      "textLength": 45000,
      "textPreview": "CONTRATO DE ARRENDAMIENTO...",
      "embeddingLength": 1536,
      "metadata": { ... }
    }
  ]
}
```

## Puntos Clave

⚠️ **MUY IMPORTANTE**: El `sessionId` debe ser el MISMO en:
- POST /upload (al subir archivo)
- POST /query (al preguntar)

El frontend crea UN SOLO `sessionId` al iniciar, así que estar en la misma sesión del navegador es crítico.

## Próximos Pasos (Si Persiste el Bug)

1. **Verificar sessionId en red**:
   - F12 → Network → XHR
   - Ver si el sessionId en /upload y /query son iguales

2. **Revisar logs de backend**:
   - ¿Aparecen los logs de indexación?
   - ¿El embedding tiene longitud > 0?

3. **Probar debug endpoint**:
   ```bash
   curl http://localhost:3000/debug/docs
   ```
   - ¿Muestra los documentos?
   - ¿El textLength es > 0?

4. **Probar embedding individual**:
   - Validar que `embed()` devuelve arrays válidos

## Archivos Modificados

- `api/src/index.js` - Endpoints /upload, /query, /debug/docs con logging  
- `api/src/chromaClient.js` - Validación de embeddings
- `api/src/deepseek.js` - Prompts para evitar alucinaciones
