import type { Message } from "../../../types";
import { API_URL } from "../../../config/constants";
import { formatMessageTime } from "../lib/formatTime";
import { runStreamedTextQuery } from "./runStreamedTextQuery";

export type SendContext = {
  question: string;
  file: File | null;
  imagePreview: string | null;
  messages: Message[];
  useLightRAG: boolean;
  sessionId: string;
  setLoading: (v: boolean) => void;
  setQuestion: (q: string) => void;
  setImagePreview: (p: string | null) => void;
  setFile: (f: File | null) => void;
  updateCurrentChat: (m: Message[]) => void;
};

export async function executeSendMessage(s: SendContext): Promise<void> {
  if (!s.question.trim() && !s.imagePreview) return;
  const question = s.question;
  const userMsg: Message = {
    role: "user",
    text: question || "(Imagen sin mensaje de texto)",
    time: formatMessageTime(),
    fileInfo: s.file
      ? {
          filename: s.file.name,
          type: s.file.type.startsWith("image/") ? "image" : "document",
          size: s.file.size,
          preview: s.file.type.startsWith("image/") ? s.imagePreview || undefined : undefined,
        }
      : undefined,
  };
  const newMessages = [...s.messages, userMsg];
  s.updateCurrentChat(newMessages);
  s.setQuestion("");
  s.setLoading(true);
  try {
    if (s.file) {
      const fd = new FormData();
      fd.append("question", question.trim() || "Resume este documento");
      fd.append("image", s.file);
      fd.append("useLightRAG", String(s.useLightRAG));
      fd.append("k", "4");
      fd.append("sessionId", s.sessionId);
      const response = await fetch(`${API_URL}/query-multimodal`, { method: "POST", body: fd });
      const data = (await response.json()) as {
        error?: string;
        answer?: string;
        docs?: unknown[];
        usedLightRAG?: boolean;
      };
      if (!response.ok) throw new Error(data.error || JSON.stringify(data));
      const assistantMsg: Message = {
        role: "assistant",
        text: data.answer || "No se obtuvo respuesta.",
        time: formatMessageTime(),
        metadata: { docsUsed: data.docs?.length, usedLightRAG: data.usedLightRAG },
      };
      s.updateCurrentChat([...newMessages, assistantMsg]);
      s.setImagePreview(null);
      s.setFile(null);
      return;
    }
    if (question.trim()) {
      await runStreamedTextQuery(newMessages, question, s.useLightRAG, s.sessionId, s.updateCurrentChat);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    s.updateCurrentChat([
      ...newMessages,
      { role: "assistant", text: `Error: ${errorMsg}`, time: formatMessageTime() },
    ]);
  } finally {
    s.setLoading(false);
  }
}
