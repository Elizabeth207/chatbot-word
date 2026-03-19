export type Message = {
  role: "user" | "assistant";
  text: string;
  time?: string;
  fileInfo?: {
    filename: string;
    type: "image" | "document";
    size: number;
    preview?: string; // Para imágenes
    chunksCount?: number;
    textLength?: number;
    approxTokens?: number;
  };
  metadata?: {
    docsUsed?: number;
    usedLightRAG?: boolean;
    chunksCount?: number;
    textLength?: number;
  }
};