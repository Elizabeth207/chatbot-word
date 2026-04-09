# Configuración de Poppler para OCR en Windows

## ¿Por qué Poppler?

El OCR de PDFs requiere convertir las páginas PDF a imágenes (PNG/JPG). `pdf2pic` usa Poppler para esto.

## Instalación en Windows

### Opción 1: Descargar pre-compilado (Recomendado)

1. **Descarga Poppler**:
   - Ve a: https://github.com/oschwartz10612/poppler-windows/releases/latest
   - Descarga `Release-XX.XX.XX.zip` (la versión más reciente)

2. **Extrae en una carpeta**:
   - Crea una carpeta: `C:\poppler`
   - Extrae el contenido ahí

3. **Agrega a PATH**:
   - Abre: Windows PowerShell como Administrador
   - Ejecuta:
     ```powershell
     [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\poppler\bin", "Machine")
     ```
   - Cierra y reabre PowerShell

4. **Verifica**:
   ```powershell
   pdftoppm --version
   ```
   Debería mostrar la versión (ej: pdftoppm version 22.02.0)

### Opción 2: Usar Chocolatey

```powershell
choco install poppler
```

### Opción 3: Windows Subsystem for Linux (WSL)

```bash
wsl
apt-get install poppler-utils
```

## Verificación

Por la terminal PowerShell en la carpeta `api`:
```powershell
cd C:\Users\ADMIN\Downloads\chatbot-word\api
# Debería funcionar sin errores
npm run dev
```

Cuando subes un PDF escaneado, deberías ver:
```
📁 [/upload] Procesando archivo: xxx.pdf
📥 Extrayendo texto de: xxx.pdf
📄 Extrayendo PDF con pdf-parse...
   → Texto extraído: 4 caracteres
⚠️  PDF tiene muy poco texto seleccionable
🔄 Convirtiendo PDF a imágenes...
   📖 Procesando imagen 1/45...
      OCR Progress: 20%
      OCR Progress: 40%
      ...
      ✓ Imagen 1: XXXX caracteres
✅ OCR completado: 250000 caracteres extraídos
```

## Si Poppler No Está Instalado

El sistema mostrará:
```
⚠️  pdf2pic falló: ...
💡 Intenta instalar poppler (Windows: descargarlo y agregarlo a PATH)
[OCR Error] Necesita Poppler instalado para procesar este PDF
```

En este caso, sigue los pasos de instalación arriba.

## Alternativas (Si no quieres instalar Poppler)

Puedes usar servicios en línea o APIs:
1. **AWS Textract** - OCR en la nube
2. **Google Cloud Vision** - OCR por imagen
3. **Azure Computer Vision** - OCR de Microsoft
4. **Libre Office** (alternativa) - requiere la herramienta `soffice` CLI

## Troubleshooting

### Error: "command not found: pdftoppm"
- PATH no está configurado correctamente
- Reinicia PowerShell después de cambiar PATH
- Verifica: `echo $env:Path | Select-String poppler`

### Error: "Poppler version 0.73.0 or higher required"
- La versión descargada es muy antigua
- Descarga una más reciente desde: https://github.com/oschwartz10612/poppler-windows

### OCR sigue fallando
- Verifica que pdftoppm funciona:
  ```powershell
  pdftoppm "C:\Users\ADMIN\Downloads\chatbot-word\contrato de arrendamiento (2).pdf" test
  ```
- Si funciona, el problema está en `pdf2pic` de Node - revisa los logs

## Notas

- OCR en PDFs de 45+ páginas puede tomar 30-60 segundos
- Poppler es software de código abierto (Libre)
- Una vez instalado, funciona para todos los proyectos Node que usen pdf2pic
