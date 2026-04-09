import './ColorPalette.css';

export function ColorPalette() {
  const colors = [
    {
      name: 'Plomo Oscuro',
      hex: '#1a1a1a',
      className: 'color-dark'
    },
    {
      name: 'Plomo Base',
      hex: '#0f0f0f',
      className: 'color-base'
    },
    {
      name: 'Plomo Medio',
      hex: '#374151',
      className: 'color-medium'
    },
    {
      name: 'Plomo Claro',
      hex: '#4b5563',
      className: 'color-light'
    },
    {
      name: 'Plomo Muy Claro',
      hex: '#6b7280',
      className: 'color-lighter'
    },
    {
      name: 'Texto Oscuro',
      hex: '#d1d5db',
      className: 'color-text-dark'
    },
    {
      name: 'Texto Claro',
      hex: '#e5e7eb',
      className: 'color-text-light'
    },
    {
      name: 'Texto Muy Claro',
      hex: '#f3f4f6',
      className: 'color-text-lighter'
    },
    {
      name: 'Éxito',
      hex: '#10b981',
      className: 'color-success'
    },
    {
      name: 'Peligro',
      hex: '#ef4444',
      className: 'color-danger'
    },
    {
      name: 'Advertencia',
      hex: '#f59e0b',
      className: 'color-warning'
    },
    {
      name: 'Información',
      hex: '#3b82f6',
      className: 'color-info'
    }
  ];

  return (
    <div className="color-palette-container">
      <div className="color-palette-header">
        <h2>Paleta de Colores</h2>
        <p>Diseño con color plomo y acentos funcionales</p>
      </div>

      <div className="color-swatches">
        {colors.map((color) => (
          <div key={color.hex} className="color-swatch">
            <div className={`swatch-preview ${color.className}`}></div>
            <div className="swatch-info">
              <div className="swatch-name">{color.name}</div>
              <div className="swatch-hex">{color.hex}</div>
            </div>
            <button
              className="swatch-copy"
              onClick={() => {
                navigator.clipboard.writeText(color.hex);
              }}
              title="Copiar código"
            >
              📋
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
