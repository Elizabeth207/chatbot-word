import React from "react";
import {
  SendIcon,
  FileIcon,
  XIcon
} from "./Icons";

interface ChatInputProps {
  question: string;
  setQuestion: (q: string) => void;
  loading: boolean;
  imagePreview: string | null;
  file: File | null;
  setFile: (f: File | null) => void;
  setImagePreview: (p: string | null) => void;
  uploading: boolean;
  onSend: () => void;
  onUpload: () => void;
  onRemoveFile: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPasteImage: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInput({
  question,
  setQuestion,
  loading,
  imagePreview,
  file,
  setFile,
  setImagePreview,
  uploading,
  onSend,
  onUpload,
  onRemoveFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onKeyPress,
  onPasteImage
}: ChatInputProps) {
  return (
    <footer className="composer" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="input-group">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Escribe tu pregunta aquí... (o pega una imagen con Ctrl+V)"
          onKeyPress={onKeyPress}
          onPaste={onPasteImage}
          disabled={loading}
          className="message-input"
        />
        <button
          onClick={onSend}
          disabled={loading || (!question.trim() && !imagePreview)}
          className="btn-send"
          title="Enviar (Enter) o enviar imagen"
        >
          <SendIcon />
        </button>
      </div>

      {imagePreview && (
        <div className="image-preview-container">
          <img src={imagePreview} alt="Preview" className="image-preview" />
          <div className="preview-info">
            <p className="preview-filename">{file?.name}</p>
            <p className="preview-hint">Imagen lista para extraer texto con OCR</p>
          </div>
        </div>
      )}

      <div className="file-area">
        <input
          id="file-input"
          type="file"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              if (selectedFile.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  setImagePreview(event.target?.result as string);
                };
                reader.readAsDataURL(selectedFile);
              } else {
                setImagePreview(null);
              }
            }
          }}
          className="file-input"
        />
        <label htmlFor="file-input" className="btn-file" title="Seleccionar archivo">
          <FileIcon />
          <span>Archivo</span>
        </label>
        {file && (
          <div className="file-selected">
            <span className="file-name">{file.name}</span>
            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
            <button
              onClick={onRemoveFile}
              className="btn-remove-file"
              title="Quitar archivo"
            >
              <XIcon />
            </button>
          </div>
        )}
        <button
          onClick={onUpload}
          disabled={uploading || !file}
          className="btn-upload"
        >
          {uploading ? "Subiendo..." : "Subir"}
        </button>
      </div>
    </footer>
  );
}