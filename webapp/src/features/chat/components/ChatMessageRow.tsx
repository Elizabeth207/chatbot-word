import ReactMarkdown from "react-markdown";
import type { Message } from "../../../types";
import { ClockIcon, DocumentIcon, PDFIcon, DocIcon, SheetIcon, PresentationIcon } from "../../../shared/ui/icons";

interface ChatMessageRowProps {
  message: Message;
}

export function ChatMessageRow({ message: m }: ChatMessageRowProps) {
  return (
    <div className={`msg-wrapper msg-${m.role}`}>
      <div className="msg">
        {m.fileInfo && (
          <div className="file-message-container">
            {m.fileInfo.type === "image" && m.fileInfo.preview ? (
              <div className="file-message-image">
                <img src={m.fileInfo.preview} alt={m.fileInfo.filename} className="file-preview-img" />
              </div>
            ) : (
              <div className="file-message-card">
                <div className="file-icon-wrapper">
                  {m.fileInfo.filename.endsWith(".pdf") && <PDFIcon />}
                  {(m.fileInfo.filename.endsWith(".doc") || m.fileInfo.filename.endsWith(".docx")) && <DocIcon />}
                  {(m.fileInfo.filename.endsWith(".xls") || m.fileInfo.filename.endsWith(".xlsx")) && <SheetIcon />}
                  {(m.fileInfo.filename.endsWith(".ppt") || m.fileInfo.filename.endsWith(".pptx")) && <PresentationIcon />}
                  {!m.fileInfo.filename.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/) && <DocumentIcon />}
                </div>
                <div className="file-card-info">
                  <div className="file-card-name">{m.fileInfo.filename}</div>
                  <div className="file-card-size">{(m.fileInfo.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            )}
            {m.fileInfo.extractedText && (
              <div className="file-extracted-text">
                <strong>Texto extraído:</strong>
                <div>{m.fileInfo.extractedText}</div>
              </div>
            )}
          </div>
        )}
        <div className="text">
          {m.role === "assistant" ? <ReactMarkdown>{m.text}</ReactMarkdown> : m.text}
        </div>
      </div>
      <div className="message-meta">
        {m.time && (
          <span className="time">
            <ClockIcon />
            {m.time}
          </span>
        )}
        {m.role === "assistant" && m.metadata?.docsUsed && (
          <span className="meta-badge">
            <DocumentIcon />
            {m.metadata.docsUsed} {m.metadata.docsUsed === 1 ? "documento" : "documentos"}
          </span>
        )}
      </div>
    </div>
  );
}
