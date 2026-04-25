import { Sidebar } from "../../layout/sidebar/Sidebar";
import { ChatHeader } from "../../features/chat/components/ChatHeader";
import { SettingsBar } from "../../features/chat/components/SettingsBar";
import { ChatMessages } from "../../features/chat/components/ChatMessages";
import { ChatInput } from "../../features/chat/components/ChatInput";
import { useChatApp } from "../../features/chat/hooks/useChatApp";

export function ChatView() {
  const c = useChatApp();
  return (
    <div className="app-layout">
      <Sidebar
        chats={c.chats}
        activeChat={c.activeChat}
        onSelectChat={(chatId) => {
          c.setActiveChat(chatId);
          c.loadChatMessages(chatId);
          c.setSidebarOpen(false);
        }}
        onNewChat={c.createNewChat}
        onDeleteChat={c.deleteChat}
        isOpen={c.sidebarOpen}
        onToggle={() => c.setSidebarOpen(!c.sidebarOpen)}
      />
      <div className="chat-root">
        <ChatHeader onClearChat={c.clearChat} />
        <SettingsBar useLightRAG={c.useLightRAG} onToggleLightRAG={c.setUseLightRAG} />
        <ChatMessages messages={c.messages} loading={c.loading} />
        <ChatInput
          question={c.question}
          setQuestion={c.setQuestion}
          file={c.file}
          setFile={c.setFile}
          loading={c.loading}
          imagePreview={c.imagePreview}
          setImagePreview={c.setImagePreview}
          uploading={c.uploading}
          onSend={c.send}
          onUpload={c.uploadFile}
          onRemoveFile={c.removeFile}
          onPasteImage={c.handlePasteImage}
          onKeyPress={c.handleKeyPress}
          onDragOver={c.handleDragOver}
          onDragLeave={c.handleDragLeave}
          onDrop={c.handleDrop}
        />
      </div>
    </div>
  );
}
