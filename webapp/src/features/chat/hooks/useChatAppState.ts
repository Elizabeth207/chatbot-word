import { useState, type Dispatch, type SetStateAction } from "react";
import type { Message, Chat } from "../../../types";

export type ChatAppState = {
  chats: Chat[];
  setChats: Dispatch<SetStateAction<Chat[]>>;
  activeChat: string | null;
  setActiveChat: Dispatch<SetStateAction<string | null>>;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  question: string;
  setQuestion: Dispatch<SetStateAction<string>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  file: File | null;
  setFile: Dispatch<SetStateAction<File | null>>;
  imagePreview: string | null;
  setImagePreview: Dispatch<SetStateAction<string | null>>;
  uploading: boolean;
  setUploading: Dispatch<SetStateAction<boolean>>;
  useLightRAG: boolean;
  setUseLightRAG: Dispatch<SetStateAction<boolean>>;
  sessionId: string;
};

export function useChatAppState(): ChatAppState {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useLightRAG, setUseLightRAG] = useState(true);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  return {
    chats, setChats, activeChat, setActiveChat, sidebarOpen, setSidebarOpen, question, setQuestion,
    messages, setMessages, loading, setLoading, file, setFile, imagePreview, setImagePreview, uploading, setUploading,
    useLightRAG, setUseLightRAG, sessionId,
  };
}
