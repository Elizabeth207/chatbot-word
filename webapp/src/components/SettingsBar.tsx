import { SearchIcon } from "./Icons";

interface SettingsBarProps {
  useLightRAG: boolean;
  onToggleLightRAG: (checked: boolean) => void;
}

export function SettingsBar({ useLightRAG, onToggleLightRAG }: SettingsBarProps) {
  return (
    <div className="settings-bar">
      <label className="toggle-item">
        <input
          type="checkbox"
          checked={useLightRAG}
          onChange={(e) => onToggleLightRAG(e.target.checked)}
          className="toggle-input"
        />
        <span className="toggle-label">
          <SearchIcon />
          <span className="label-text">Modo de búsqueda</span>
        </span>
      </label>
    </div>
  );
}