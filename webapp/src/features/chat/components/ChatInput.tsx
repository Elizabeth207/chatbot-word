import type { ClipboardEvent, DragEvent, KeyboardEvent } from "react";
import { ChatInputTextarea } from "./ChatInputTextarea";
import { ChatInputFileBar } from "./ChatInputFileBar";

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
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onKeyPress: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPasteImage: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInput(props: ChatInputProps) {
  return (
    <footer
      className="composer"
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <ChatInputTextarea
        question={props.question}
        setQuestion={props.setQuestion}
        loading={props.loading}
        imagePreview={props.imagePreview}
        file={props.file}
        onSend={props.onSend}
        onKeyPress={props.onKeyPress}
        onPasteImage={props.onPasteImage}
      />
      <ChatInputFileBar
        file={props.file}
        setFile={props.setFile}
        setImagePreview={props.setImagePreview}
        uploading={props.uploading}
        onUpload={props.onUpload}
        onRemoveFile={props.onRemoveFile}
      />
    </footer>
  );
}
