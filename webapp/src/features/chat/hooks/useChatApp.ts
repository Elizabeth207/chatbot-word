import { useChatAppState } from "./useChatAppState";
import { useChatAppLifecycle } from "./useChatAppLifecycle";
import { useChatAppActions } from "./useChatAppActions";

export function useChatApp() {
  const state = useChatAppState();
  const life = useChatAppLifecycle(state);
  const actions = useChatAppActions(state, life);
  return {
    chats: state.chats,
    activeChat: state.activeChat,
    setActiveChat: state.setActiveChat,
    sidebarOpen: state.sidebarOpen,
    setSidebarOpen: state.setSidebarOpen,
    question: state.question,
    setQuestion: state.setQuestion,
    messages: state.messages,
    loading: state.loading,
    file: state.file,
    setFile: state.setFile,
    imagePreview: state.imagePreview,
    setImagePreview: state.setImagePreview,
    uploading: state.uploading,
    useLightRAG: state.useLightRAG,
    setUseLightRAG: state.setUseLightRAG,
    sessionId: state.sessionId,
    createNewChat: life.createNewChat,
    loadChatMessages: life.loadChatMessages,
    deleteChat: life.deleteChat,
    ...actions,
  };
}
