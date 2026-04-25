import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { executeSendMessage } from "../logic/executeSendMessage";
import { executeUploadFile } from "../logic/executeUploadFile";
import type { ChatAppState } from "./useChatAppState";
import type { ChatLifecycle } from "./useChatAppLifecycle";

export function useChatAppActions(s: ChatAppState, life: ChatLifecycle) {
  const {
    question, setQuestion, file, imagePreview, messages, useLightRAG, sessionId, setLoading,
    setFile, setImagePreview, setUploading, setMessages, activeChat,
  } = s;
  const { updateCurrentChat } = life;

  const send = () => {
    void executeSendMessage({
      question,
      file,
      imagePreview,
      messages,
      useLightRAG,
      sessionId,
      setLoading,
      setQuestion,
      setImagePreview,
      setFile,
      updateCurrentChat,
    });
  };

  const uploadFile = () => {
    if (!file) return;
    void executeUploadFile({
      file,
      imagePreview,
      sessionId,
      messages,
      setUploading,
      setFile,
      setImagePreview,
      updateCurrentChat,
    });
  };

  const clearChat = () => {
    setMessages([]);
    setQuestion("");
    setFile(null);
    if (activeChat) localStorage.removeItem(`chat_messages_${activeChat}`);
  };
  const removeFile = () => {
    setFile(null);
    setImagePreview(null);
  };

  const handlePasteImage = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.includes("image")) {
        e.preventDefault();
        const f = items[i].getAsFile();
        if (f) {
          setFile(f);
          const r = new FileReader();
          r.onload = (ev) => setImagePreview(ev.target?.result as string);
          r.readAsDataURL(f);
        }
        break;
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  const handleDragOver = (_e: DragEvent<Element>) => {};
  const handleDragLeave = (_e: DragEvent<Element>) => {};
  const handleDrop = (_e: DragEvent<Element>) => {};

  return {
    send,
    uploadFile,
    clearChat,
    removeFile,
    handlePasteImage,
    handleKeyPress,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
