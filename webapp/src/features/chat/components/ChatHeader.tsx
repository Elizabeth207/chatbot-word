import { RefreshIcon } from "../../../shared/ui/icons";

interface ChatHeaderProps {
  onClearChat: () => void;
}

export function ChatHeader({ onClearChat }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="header-content">
        <h1>Asistente RAG Inteligente</h1>
        <p className="subtitle">Análisis inteligente de documentos</p>
      </div>
      <button onClick={onClearChat} className="btn-refresh" title="Nueva conversación">
        <RefreshIcon />
      </button>
    </header>
  );
}
