# Diseño de Diálogos - Color Plomo con Iconos

## Overview

Se implementó un sistema de diálogos elegantes con:
- **Color plomo** como color principal (#374151, #4b5563)
- **Iconos SVG** en lugar de emojis
- **Animaciones suaves** con transiciones
- **Efecto glass-morphism** con blur
- **Respuesta táctil** (ripple effect)
- **Diseño responsive** para móvil

## Componentes

### 1. ConfirmDialog.tsx
Componente reutilizable para confirmar acciones:
- Acepta título, mensaje, textos de botones
- Prop `isDangerous` para cambiar color a rojo
- Animations de entrada suave
- Cierra al hacer click fuera (backdrop)

```tsx
<ConfirmDialog
  isOpen={isOpen}
  title="Eliminar chat"
  message="¿Estás seguro?"
  confirmText="Eliminar"
  cancelText="Cancelar"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  isDangerous={true}
/>
```

### 2. ColorPalette.tsx
Componente para visualizar la paleta de colores:
- Grid de swatches (muestras)
- Muestra nombre hexadecimal
- Botón para copiar código de color
- Hover effects atractivos

## Paleta de Colores

### Tonos Plomo
- `#1a1a1a` - Plomo Oscuro
- `#0f0f0f` - Plomo Base
- `#374151` - Plomo Medio
- `#4b5563` - Plomo Claro
- `#6b7280` - Plomo Muy Claro

### Textos
- `#d1d5db` - Texto Oscuro
- `#e5e7eb` - Texto Claro
- `#f3f4f6` - Texto Muy Claro

### Funcionales
- `#10b981` - Éxito (Verde)
- `#ef4444` - Peligro (Rojo)
- `#f59e0b` - Advertencia (Ámbar)
- `#3b82f6` - Información (Azul)

## Características del Diseño

### Animaciones
```css
/* Entrada suave */
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Ondulación en click */
@keyframes ripple {
  to { width: 200px; height: 200px; opacity: 0; }
}
```

### Efectos Visuales
- **Blur backdrop** (6px) para efecto glass
- **Sombras múltiples** para profundidad
- **Gradientes sutiles** en botones
- **Border glow** opcional en hover

### Iconos
Usando SVG nativo sin dependencias:
- ✓ CheckIcon (confirmar)
- ✗ XIcon (cancelar)
- ☰ MenuIcon (toggle)
- + PlusIcon (nuevo)
- 🗑 TrashIcon (eliminar)

## Uso en la Aplicación

El Sidebar ahora usa ConfirmDialog para la eliminación:

```tsx
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

<ConfirmDialog
  isOpen={!!deleteConfirm}
  title="Eliminar chat"
  message={`¿Eliminar "${chat?.title}"? Sin deshacer.`}
  onConfirm={handleConfirmDelete}
  onCancel={handleCancelDelete}
  isDangerous={true}
/>
```

## Responsive Design

- **Desktop**: Dialogo centrado, ancho 420px máximo
- **Mobile**: Full-width con padding, botones en fila o columna según espacio
- **Tablet**: Escala intermedia

## Características Adicionales

✅ Backdrop oscuro con blur (no bloquea totalmente)
✅ Cierre con ESC (opcional, implementar)
✅ Accesibilidad (focus management)
✅ Sin dependencias externas
✅ Animaciones 60fps (transitions)
✅ Touch-friendly (40px min-height)

## Instalación

Los componentes están listos para usar:

```tsx
import { ConfirmDialog } from './components/ConfirmDialog';
import { ColorPalette } from './components/ColorPalette';
```

## Próximas Mejoras (Opcional)

- [ ] Toast notifications con mismo diseño
- [ ] Modal dialog para más contenido
- [ ] Keyboard shortcuts (ESC para cerrar)
- [ ] Multi-select confirmations
- [ ] Tema claro (light mode)
