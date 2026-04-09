import { useState } from 'react';
import './Sidebar.css';
import { TrashIcon, PlusIcon, MenuIcon } from './Icons';
import { ConfirmDialog } from './ConfirmDialog';

export type Chat = {
  id: string;
  title: string;
  createdAt: number;
};

interface SidebarProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ chats, activeChat, onSelectChat, onNewChat, onDeleteChat, isOpen, onToggle }: SidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDeleteClick = (chatId: string) => {
    setDeleteConfirm(chatId);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      onDeleteChat(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const chartToDelete = deleteConfirm ? chats.find(c => c.id === deleteConfirm) : null;

  return (
    <>
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Eliminar chat"
        message={`¿Eliminar "${chartToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous={true}
      />

      {/* Mobile Menu Button */}
      <button className="sidebar-toggle" onClick={onToggle}>
        <MenuIcon />
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* New Chat Button */}
        <button className="new-chat-btn" onClick={onNewChat}>
          <PlusIcon />
          <span>Nuevo Chat</span>
        </button>

        {/* Chats List */}
        <div className="chats-list">
          <div className="chats-section">
            <h3 className="section-title">Chats Recientes</h3>
            {chats.length === 0 ? (
              <div className="no-chats">Sin chats aún</div>
            ) : (
              <ul>
                {chats.map((chat) => (
                  <li key={chat.id} className={`chat-item ${activeChat === chat.id ? 'active' : ''}`}>
                    <button
                      className="chat-link"
                      onClick={() => {
                        onSelectChat(chat.id);
                        // Cerrar sidebar en mobile
                        if (window.innerWidth < 768) {
                          onToggle();
                        }
                      }}
                      title={chat.title}
                    >
                      <span className="chat-title">{chat.title}</span>
                      <span className="chat-date">
                        {new Date(chat.createdAt).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </button>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(chat.id);
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

        {/* Overlay for mobile */}
        <div className="sidebar-overlay" onClick={onToggle}></div>
      </aside>
    </>
  );
}
