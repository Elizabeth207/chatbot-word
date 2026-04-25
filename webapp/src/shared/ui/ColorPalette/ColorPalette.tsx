import "./ColorPalette.css";
import { PALETTE_COLORS } from "./colorPaletteData";

export function ColorPalette() {
  return (
    <div className="color-palette-container">
      <div className="color-palette-header">
        <h2>Paleta de Colores</h2>
        <p>Diseño con color plomo y acentos funcionales</p>
      </div>
      <div className="color-swatches">
        {PALETTE_COLORS.map((color) => (
          <div key={color.hex} className="color-swatch">
            <div className={`swatch-preview ${color.className}`}></div>
            <div className="swatch-info">
              <div className="swatch-name">{color.name}</div>
              <div className="swatch-hex">{color.hex}</div>
            </div>
            <button
              className="swatch-copy"
              onClick={() => navigator.clipboard.writeText(color.hex)}
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
