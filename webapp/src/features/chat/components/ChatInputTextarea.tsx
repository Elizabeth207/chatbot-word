import { SendIcon } from "../../../shared/ui/icons";

interface ChatInputTextareaProps {
  question: string;
  setQuestion: (q: string) => void;
  loading: boolean;
  imagePreview: string | null;
  file: File | null;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPasteImage: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInputTextarea({
  question,
  setQuestion,
  loading,
  imagePreview,
  file,
  onSend,
  onKeyPress,
  onPasteImage,
}: ChatInputTextareaProps) {
  return (
    <>
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
    </>
  );
}
