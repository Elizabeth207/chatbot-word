import { useState } from "react";
import "./Sidebar.css";
import { PlusIcon, MenuIcon } from "../../shared/ui/icons";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog/ConfirmDialog";
import { SidebarChatsList } from "./SidebarChatsList";
import type { Chat } from "../../types";

export type { Chat };

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
  const chatToDelete = deleteConfirm ? chats.find((c) => c.id === deleteConfirm) : null;

  return (
    <>
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Eliminar chat"
        message={`¿Eliminar "${chatToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={() => {
          if (deleteConfirm) {
            onDeleteChat(deleteConfirm);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
        isDangerous={true}
      />
      <button className="sidebar-toggle" onClick={onToggle}>
        <MenuIcon />
      </button>
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <button className="new-chat-btn" onClick={onNewChat}>
          <PlusIcon />
          <span>Nuevo Chat</span>
        </button>
        <SidebarChatsList
          chats={chats}
          activeChat={activeChat}
          onSelectChat={onSelectChat}
          onToggle={onToggle}
          onRequestDelete={(id) => setDeleteConfirm(id)}
        />
        <div className="sidebar-overlay" onClick={onToggle}></div>
      </aside>
    </>
  );
}
