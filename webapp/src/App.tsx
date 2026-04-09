import { useState, useEffect } from "react";
import "./App.css";
import type { Message } from "./types";
import type { Chat } from "./components/Sidebar";
import { Sidebar } from "./components/Sidebar";
import { ChatHeader } from "./components/ChatHeader";
import { SettingsBar } from "./components/SettingsBar";
import { ChatMessages } from "./components/ChatMessages";
import { ChatInput } from "./components/ChatInput";

const RAILWAY_API_URL =
  import.meta.env.PROD
    ? "https://chatbot-word-production.up.railway.app"
    : "http://localhost:3000";

const STORAGE_KEY = "chatbot_conversations";

function App() {
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

  // Cargar chats del localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setChats(parsed);
        if (parsed.length > 0) {
          setActiveChat(parsed[0].id);
          loadChatMessages(parsed[0].id);
        }
      } catch (e) {
        console.error("Error cargando chats:", e);
      }
    } else {
      createNewChat();
    }
  }, []);

  // Guardar chats en localStorage cuando cambian
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }
  }, [chats]);

  function generateTitle(text: string): string {
    const words = text.trim().split(/\s+/).slice(0, 6).join(" ");
    return words.length > 30 ? words.substring(0, 27) + "..." : words;
  }

  function createNewChat() {
    const newChat: Chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: "Nuevo Chat",
      createdAt: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChat.id);
    setMessages([]);
    setQuestion("");
    setFile(null);
    setImagePreview(null);
  }

  function loadChatMessages(chatId: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      const stored = localStorage.getItem(`chat_messages_${chatId}`);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (e) {
          console.error("Error cargando mensajes:", e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }

  function updateCurrentChat(newMessages: Message[]) {
    if (activeChat) {
      localStorage.setItem(`chat_messages_${activeChat}`, JSON.stringify(newMessages));
      setMessages(newMessages);

      // Actualizar título si es el primer mensaje
      if (newMessages.length === 1 && newMessages[0].role === "user") {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeChat
              ? { ...chat, title: generateTitle(newMessages[0].text) }
              : chat
          )
        );
      }
    }
  }

  function deleteChat(chatId: string) {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    localStorage.removeItem(`chat_messages_${chatId}`);

    if (activeChat === chatId) {
      const remaining = chats.filter((c) => c.id !== chatId);
      if (remaining.length > 0) {
        setActiveChat(remaining[0].id);
        loadChatMessages(remaining[0].id);
      } else {
        createNewChat();
      }
    }
  }

  async function send() {
    if (!question.trim() && !imagePreview) return;

    const userMsg: Message = {
      role: "user",
      text: question || "(Imagen sin mensaje de texto)",
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      fileInfo: file
        ? {
            filename: file.name,
            type: file.type.startsWith("image/") ? "image" : "document",
            size: file.size,
            preview: file.type.startsWith("image/") ? imagePreview || undefined : undefined,
          }
        : undefined
    };
    
    const newMessages = [...messages, userMsg];
    updateCurrentChat(newMessages);
    setQuestion("");
    setLoading(true);

    try {
      let response;

      if (file) {
        const fd = new FormData();
        fd.append("question", question.trim() || "Resume este documento");
        fd.append("image", file);
        fd.append("useLightRAG", String(useLightRAG));
        fd.append("k", "4");
        fd.append("sessionId", sessionId);

        response = await fetch(`${RAILWAY_API_URL}/query-multimodal`, {
          method: "POST",
          body: fd,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || JSON.stringify(data));

        const assistantMsg: Message = {
          role: "assistant",
          text: data.answer || "No se obtuvo respuesta.",
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          metadata: {
            docsUsed: data.docs?.length,
            usedLightRAG: data.usedLightRAG
          }
        };
        updateCurrentChat([...newMessages, assistantMsg]);
        setImagePreview(null);
        setFile(null);
        return;
      } else if (question.trim()) {
        const body = { question, useLightRAG, k: 4, sessionId };
        response = await fetch(`${RAILWAY_API_URL}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedAnswer = "";
        let metadata: any = {};

        const assistantMsg: Message = {
          role: "assistant",
          text: "",
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          metadata: {}
        };
        
        const messagesWithAssistant = [...newMessages, assistantMsg];
        updateCurrentChat(messagesWithAssistant);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.token) {
                    accumulatedAnswer += data.token;
                    updateCurrentChat([
                      ...messagesWithAssistant.slice(0, -1),
                      { ...assistantMsg, text: accumulatedAnswer }
                    ]);
                  } else if (data.complete) {
                    metadata = data.complete;
                  }
                } catch (e) {
                }
              }
            }
          }
        } catch (err) {
          throw err;
        }

        updateCurrentChat([
          ...messagesWithAssistant.slice(0, -1),
          {
            ...assistantMsg,
            text: accumulatedAnswer,
            metadata: {
              docsUsed: metadata.docs?.length,
              usedLightRAG: metadata.usedLightRAG
            }
          }
        ]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateCurrentChat([...newMessages, { 
        role: "assistant", 
        text: `Error: ${errorMsg}`, 
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) 
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("sessionId", sessionId);
      const resp = await fetch(`${RAILWAY_API_URL}/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || JSON.stringify(data));

      const isImage = file.type.startsWith("image/");
      let preview = undefined;
      if (isImage && imagePreview) {
        preview = imagePreview;
      }

      const statusMsg = `**${data.id}** subido exitosamente\n\n` +
        `Chunks: ${data.chunksCount} | Caracteres: ${data.textLength?.toLocaleString()} | Tokens: ~${data.metadata?.approxTokens?.toLocaleString()}`;

      const fullText = data.extractedText ? `\n\nTexto extraído:\n${data.extractedText}` : "";
      const assistantMsg: Message = {
        role: "assistant",
        text: statusMsg + fullText,
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        fileInfo: {
          filename: file.name,
          type: isImage ? "image" : "document",
          size: file.size,
          preview,
          chunksCount: data.chunksCount,
          textLength: data.textLength,
          approxTokens: data.metadata?.approxTokens,
          extractedText: data.extractedText
        },
        metadata: {
          chunksCount: data.chunksCount,
          textLength: data.textLength
        }
      };
      updateCurrentChat([...messages, assistantMsg]);
      setFile(null);
      setImagePreview(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      updateCurrentChat([...messages, { role: "assistant", text: `Error: ${errorMsg}`, time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setUploading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setQuestion("");
    setFile(null);
    if (activeChat) {
      localStorage.removeItem(`chat_messages_${activeChat}`);
    }
  }

  function removeFile() {
    setFile(null);
    setImagePreview(null);
  }

  function handlePasteImage(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes("image")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          setFile(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleDragOver(_e: React.DragEvent<Element>) {
  }

  function handleDragLeave(_e: React.DragEvent<Element>) {
  }

  function handleDrop(_e: React.DragEvent<Element>) {
  }

  return (
    <div className="app-layout">
      <Sidebar
        chats={chats}
        activeChat={activeChat}
        onSelectChat={(chatId) => {
          setActiveChat(chatId);
          loadChatMessages(chatId);
          setSidebarOpen(false);
        }}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="chat-root">
        <ChatHeader onClearChat={clearChat} />

        <SettingsBar useLightRAG={useLightRAG} onToggleLightRAG={setUseLightRAG} />

        <ChatMessages messages={messages} loading={loading} />

        <ChatInput
          question={question}
          setQuestion={setQuestion}
          file={file}
          setFile={setFile}
          loading={loading}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          uploading={uploading}
          onSend={send}
          onUpload={uploadFile}
          onRemoveFile={removeFile}
          onPasteImage={handlePasteImage}
          onKeyPress={handleKeyPress}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}

export default App;
