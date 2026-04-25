import { useEffect } from "react";
import type { Message, Chat } from "../../../types";
import { STORAGE_KEY } from "../../../config/constants";
import { generateTitle } from "../lib/generateTitle";
import type { ChatAppState } from "./useChatAppState";

export type ChatLifecycle = {
  createNewChat: () => void;
  loadChatMessages: (chatId: string) => void;
  updateCurrentChat: (newMessages: Message[]) => void;
  deleteChat: (chatId: string) => void;
};

export function useChatAppLifecycle(s: ChatAppState): ChatLifecycle {
  const {
    chats, setChats, activeChat, setActiveChat, setMessages, setQuestion, setFile, setImagePreview,
  } = s;

  function createNewChat() {
    const newChat: Chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: "Nuevo Chat",
      createdAt: Date.now(),
    };
    setChats((p) => [newChat, ...p]);
    setActiveChat(newChat.id);
    setMessages([]);
    setQuestion("");
    setFile(null);
    setImagePreview(null);
  }

  function loadChatMessages(chatId: string) {
    const c = chats.find((x) => x.id === chatId);
    if (c) {
      const st = localStorage.getItem(`chat_messages_${chatId}`);
      if (st) {
        try {
          setMessages(JSON.parse(st) as Message[]);
        } catch (e) {
          console.error("Error cargando mensajes:", e);
          setMessages([]);
        }
      } else setMessages([]);
    }
  }

  function updateCurrentChat(newMessages: Message[]) {
    if (!activeChat) return;
    localStorage.setItem(`chat_messages_${activeChat}`, JSON.stringify(newMessages));
    setMessages(newMessages);
    if (newMessages.length === 1 && newMessages[0].role === "user") {
      setChats((prev) =>
        prev.map((ch) => (ch.id === activeChat ? { ...ch, title: generateTitle(newMessages[0].text) } : ch))
      );
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: Chat[] = JSON.parse(stored);
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChat(parsed[0].id);
          loadChatMessages(parsed[0].id);
        }
      } catch (e) {
        console.error("Error cargando chats:", e);
      }
    } else createNewChat();
  }, []);

  useEffect(() => {
    if (chats.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  function deleteChat(chatId: string) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    localStorage.removeItem(`chat_messages_${chatId}`);
    if (activeChat === chatId) {
      const rem = chats.filter((c) => c.id !== chatId);
      if (rem.length > 0) {
        setActiveChat(rem[0].id);
        loadChatMessages(rem[0].id);
      } else createNewChat();
    }
  }

  return { createNewChat, loadChatMessages, updateCurrentChat, deleteChat };
}
