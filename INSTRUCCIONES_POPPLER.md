# ✅ PRÓXIMOS PASOS - Instalación de Poppler para OCR

## Diagnóstico Actual

El sistema verificó que:
- ✓ Node.js y npm están OK
- ✓ Backend OCR code está implementado
- ✗ **Poppler NO está instalado** ← ⚠️ REQUERIDO para procesar PDFs escaneados

## ¿Qué es Poppler?

Poppler es la herramienta que convierte páginas PDF a imágenes PNG que Tesseract puede procesar con OCR.

## Procedimiento Rápido (5 min)

### 1️⃣ Descargar Poppler para Windows

1. Abre: https://github.com/oschwartz10612/poppler-windows/releases
2. Descarga el archivo más reciente (probablemente `Release-24.xx.xx.zip`)
3. Extrae a: `C:\poppler`

```
C:\poppler\
  ├── bin/
  │   ├── pdftoppm.exe ✓  (esto es lo importante)
  │   ├── pdfinfo.exe
  │   └── ...
  └── lib/
```

### 2️⃣ Agregar a PATH de Windows

En **PowerShell como Administrador**:

```powershell
# Ejecuta esto:
[Environment]::SetEnvironmentVariable(
  "Path", 
  $env:Path + ";C:\poppler\bin", 
  "Machine"
)

# Reinicia PowerShell completamente (cierra y abre nueva ventana)
```

### 3️⃣ Verificar que funciona

```powershell
pdftoppm --version
```

**Esperado**: `pdftoppm version 24.xx.xx`

### 4️⃣ Iniciar el backend

```powershell
cd C:\Users\ADMIN\Downloads\chatbot-word\api
npm run dev
```

Debería ver:
```
RAG API listening on http://localhost:3000
```

### 5️⃣ Probar upload en otra terminal

```powershell
cd C:\Users\ADMIN\Downloads\chatbot-word\webapp
npm run dev
```

Abre: http://localhost:5173

Sube el PDF escaneado y observa en la terminal del backend:

```
📁 [/upload] Procesando archivo: contrato de arrendamiento (2).pdf
📥 Extrayendo texto
📄 Extrayendo PDF con pdf-parse...
   → Texto extraído: 4 caracteres
⚠️  PDF tiene muy poco texto seleccionable
🔄 Convirtiendo PDF a imágenes... ← AQUÍ POPPLER ACTÚA
   📖 Procesando imagen 1/45...
      OCR Progress: 20%
      OCR Progress: 40%
      ...
✅ OCR completado: 250000 caracteres extraídos
```

---

## Troubleshooting

### "pdftoppm command not found" (Comando no encontrado)

**Solución**: Reinicia **completamente** PowerShell después de cambiar PATH
- Cierra PowerShell
- Abre una nueva ventana
- Intenta `pdftoppm --version` de nuevo

### "Poppler version too old" (Versión muy vieja)

**Solución**: Descarga una versión reciente:
https://github.com/oschwartz10612/poppler-windows/releases
- Versión mínima recomendada: 22.02.0
- Versión ideal: 24.x.x

### "It works but OCR is slow"

Normal para PDFs de 45+ páginas:
- 2 páginas: 1-2 segundos
- 10 páginas: 10-15 segundos
- 45 páginas: 30-60 segundos

Esto depende de tu CPU.

### "Still getting errors?"

Abre PowerShell y ejecuta:

```powershell
# 1. Verifica que Poppler está en PATH:
echo $env:Path

# 2. Verifica que pdftoppm funciona:
pdftoppm --version

# 3. Ve a la carpeta api:
cd C:\Users\ADMIN\Downloads\chatbot-word\api

# 3. Revisa los logs:
npm run dev
```

Copia los logs del error y puedo ayudarte a diagnosticar.

---

## Si NO Quieres Instalar Poppler

Alternativas (más complicadas):
1. **Usar Google Cloud Vision API** - Requiere cuenta Google, API key
2. **Usar AWS Textract** - Requiere cuenta AWS
3. **Usar Azure Computer Vision** - Requiere cuenta Microsoft

Particularmente, la opción más simple sigue siendo instalar Poppler localmente.

---

## ¿Ya instalaste Poppler?

Verifica ejecutando el script de verificación:

```powershell
cd C:\Users\ADMIN\Downloads\chatbot-word
node verify-setup.js
```

Debería mostrar:
- ✓ Node.js & npm
- ✓ Tesseract.js
- ✓ pdf2pic
- ✓ Poppler ← DEBE MOSTRAR ✓

---

## ¡Listo!

Una vez instalado Poppler, el OCR funcionará automáticamente:

1. **Backend**: `npm run dev` en carpeta `api/`
2. **Frontend**: `npm run dev` en carpeta `webapp/`
3. **Subir PDF escaneado** y hacer preguntas
4. **El chatbot responderá basado en el contenido extraído**

¡Déjame saber cuando esté listo!
