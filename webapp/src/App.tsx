import { useState } from "react";
import "./App.css";
import type { Message } from "./types";
import { ChatHeader } from "./components/ChatHeader";
import { SettingsBar } from "./components/SettingsBar";
import { ChatMessages } from "./components/ChatMessages";
import { ChatInput } from "./components/ChatInput";

// Detectar si estamos en producción o desarrollo
const RAILWAY_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://chatbot-word-production.up.railway.app"
    : "http://localhost:3000";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useLightRAG, setUseLightRAG] = useState(true);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  async function send() {
    if (!question.trim() && !imagePreview) return;
    
    const userMsg: Message = { 
      role: "user", 
      text: question || "(Imagen sin mensaje de texto)",
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) 
    };
    setMessages((m) => [...m, userMsg]);
    setQuestion("");
    setLoading(true);
    
    try {
      let response;

      // Si hay imagen + texto: usar endpoint multimodal
      if (imagePreview && file) {
        const fd = new FormData();
        fd.append("question", question.trim() || "Analiza esta imagen");
        fd.append("image", file);
        fd.append("useLightRAG", String(useLightRAG));
        fd.append("k", "4");
        fd.append("sessionId", sessionId);

        response = await fetch(`${RAILWAY_API_URL}/query-multimodal`, {
          method: "POST",
          body: fd,
        });
      } else if (question.trim()) {
        // Solo texto: usar endpoint normal con streaming
        const body = { question, useLightRAG, k: 4, sessionId };
        response = await fetch(`${RAILWAY_API_URL}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Manejar streaming SSE
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedAnswer = "";
        let metadata: any = {};

        // Agregar mensaje del assistant inicialmente vacío
        const assistantMsg: Message = {
          role: "assistant",
          text: "",
          time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          metadata: {}
        };
        setMessages((m) => [...m, assistantMsg]);

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
                    // Actualizar el mensaje en tiempo real
                    setMessages((m) => {
                      const newMsgs = [...m];
                      const lastMsg = newMsgs[newMsgs.length - 1];
                      if (lastMsg.role === "assistant") {
                        lastMsg.text = accumulatedAnswer;
                      }
                      return newMsgs;
                    });
                  } else if (data.complete) {
                    metadata = data.complete;
                  }
                } catch (e) {
                  // Ignorar líneas no parseables
                }
              }
            }
          }
        } catch (err) {
          throw err;
        }

        // Actualizar metadata final
        setMessages((m) => {
          const newMsgs = [...m];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.metadata = {
              docsUsed: metadata.docs?.length,
              usedLightRAG: metadata.usedLightRAG
            };
          }
          return newMsgs;
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${errorMsg}`, time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }]);
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

      // Determinar tipo y obtener preview para imágenes
      const isImage = file.type.startsWith("image/");
      let preview = undefined;
      if (isImage && imagePreview) {
        preview = imagePreview;
      }

      const statusMsg = `**${data.id}** subido exitosamente\n\n` +
        `Chunks: ${data.chunksCount} | Caracteres: ${data.textLength?.toLocaleString()} | Tokens: ~${data.metadata?.approxTokens?.toLocaleString()}`;

      const assistantMsg: Message = {
        role: "assistant",
        text: statusMsg,
        time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        fileInfo: {
          filename: file.name,
          type: isImage ? "image" : "document",
          size: file.size,
          preview,
          chunksCount: data.chunksCount,
          textLength: data.textLength,
          approxTokens: data.metadata?.approxTokens
        },
        metadata: {
          chunksCount: data.chunksCount,
          textLength: data.textLength
        }
      };
      setMessages((m) => [...m, assistantMsg]);
      setFile(null);
      setImagePreview(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${errorMsg}`, time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setUploading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setQuestion("");
    setFile(null);
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
    // Drag handling moved to ChatInput component
  }

  function handleDragLeave(_e: React.DragEvent<Element>) {
    // Drag handling moved to ChatInput component
  }

  function handleDrop(_e: React.DragEvent<Element>) {
    // Drag handling moved to ChatInput component
  }

  return (
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
  );
}

export default App;
