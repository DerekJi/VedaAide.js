import { ChatInterface } from "@/components/chat/chat-interface";

// Chat page — thin wrapper that renders the ChatInterface component.
// All state management lives in ChatInterface + useChatStream + useChatStore.
export default function ChatPage() {
  return <ChatInterface />;
}
