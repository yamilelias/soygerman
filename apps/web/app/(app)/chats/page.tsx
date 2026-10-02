import { ChatExplorer } from "@/components/chat-explorer";
import { listChats } from "@/lib/chats";

export default async function ChatsPage() {
  const chats = await listChats();
  return <ChatExplorer chats={chats} />;
}
