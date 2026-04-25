import type { Message } from "../../../types";
import { API_URL } from "../../../config/constants";
import { formatMessageTime } from "../lib/formatTime";

export type UploadContext = {
  file: File;
  imagePreview: string | null;
  sessionId: string;
  messages: Message[];
  setUploading: (v: boolean) => void;
  setFile: (f: File | null) => void;
  setImagePreview: (p: string | null) => void;
  updateCurrentChat: (m: Message[]) => void;
};

export async function executeUploadFile(u: UploadContext): Promise<void> {
  u.setUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", u.file, u.file.name);
    fd.append("sessionId", u.sessionId);
    const resp = await fetch(`${API_URL}/upload`, { method: "POST", body: fd });
    const data = (await resp.json()) as {
      error?: string;
      id?: string;
      chunksCount?: number;
      textLength?: number;
      extractedText?: string;
      metadata?: { approxTokens?: number };
    };
    if (!resp.ok) throw new Error(data.error || JSON.stringify(data));
    const isImage = u.file.type.startsWith("image/");
    const preview = isImage && u.imagePreview ? u.imagePreview : undefined;
    const statusMsg =
      `**${data.id}** subido exitosamente\n\n` +
      `Chunks: ${data.chunksCount} | Caracteres: ${data.textLength?.toLocaleString()} | Tokens: ~${data.metadata?.approxTokens?.toLocaleString()}`;
    const fullText = data.extractedText ? `\n\nTexto extraído:\n${data.extractedText}` : "";
    const assistantMsg: Message = {
      role: "assistant",
      text: statusMsg + fullText,
      time: formatMessageTime(),
      fileInfo: {
        filename: u.file.name,
        type: isImage ? "image" : "document",
        size: u.file.size,
        preview,
        chunksCount: data.chunksCount,
        textLength: data.textLength,
        approxTokens: data.metadata?.approxTokens,
        extractedText: data.extractedText,
      },
      metadata: { chunksCount: data.chunksCount, textLength: data.textLength },
    };
    u.updateCurrentChat([...u.messages, assistantMsg]);
    u.setFile(null);
    u.setImagePreview(null);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    u.updateCurrentChat([
      ...u.messages,
      { role: "assistant", text: `Error: ${errorMsg}`, time: formatMessageTime() },
    ]);
  } finally {
    u.setUploading(false);
  }
}
