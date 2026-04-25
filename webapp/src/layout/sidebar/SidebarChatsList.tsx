import type { Chat } from "../../types";
import { TrashIcon } from "../../shared/ui/icons";

interface SidebarChatsListProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (chatId: string) => void;
  onToggle: () => void;
  onRequestDelete: (chatId: string) => void;
}

export function SidebarChatsList({
  chats,
  activeChat,
  onSelectChat,
  onToggle,
  onRequestDelete,
}: SidebarChatsListProps) {
  return (
    <div className="chats-list">
      <div className="chats-section">
        <h3 className="section-title">Chats Recientes</h3>
        {chats.length === 0 ? (
          <div className="no-chats">Sin chats aún</div>
        ) : (
          <ul>
            {chats.map((chat) => (
              <li key={chat.id} className={`chat-item ${activeChat === chat.id ? "active" : ""}`}>
                <button
                  className="chat-link"
                  onClick={() => {
                    onSelectChat(chat.id);
                    if (window.innerWidth < 768) onToggle();
                  }}
                  title={chat.title}
                >
                  <span className="chat-title">{chat.title}</span>
                  <span className="chat-date">
                    {new Date(chat.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                  </span>
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete(chat.id);
                  }}
                  title="Eliminar chat"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
