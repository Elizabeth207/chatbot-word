import { useEffect } from "react";
import "./ConfirmDialog.css";
import { CheckIcon, XIcon } from "../icons";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isOpen: boolean;
  isDangerous?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  isOpen,
  isDangerous = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <h2>{title}</h2>
        </div>
        <div className="confirm-message">
          <p>{message}</p>
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel-btn" onClick={onCancel} title={cancelText}>
            <XIcon />
            <span>{cancelText}</span>
          </button>
          <button
            className={`confirm-btn confirm-btn-action ${isDangerous ? "dangerous" : "success"}`}
            onClick={onConfirm}
            title={confirmText}
            autoFocus
          >
            <CheckIcon />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
