import type { Message } from "../../../types";
import { SearchIcon } from "../../../shared/ui/icons";
import { ChatMessageRow } from "./ChatMessageRow";

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
}

export function ChatMessages({ messages, loading }: ChatMessagesProps) {
  return (
    <>
      <div className="recent-bar">Mensajes recientes</div>
      <main className="chat-window">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <SearchIcon />
              <p>Comienza la conversación</p>
              <span className="hint">Escribe tu pregunta o sube un archivo</span>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatMessageRow key={i} message={m} />
          ))}
          {loading && (
            <div className="msg-wrapper msg-assistant">
              <div className="msg loading-msg">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
