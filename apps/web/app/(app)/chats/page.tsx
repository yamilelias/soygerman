import { ChatExplorer } from "@/components/chat-explorer";
import type { Chat } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export default async function ChatsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chats")
    .select("id, user_id, wa_id, name, is_group, updated_at")
    .order("name");

  return <ChatExplorer chats={(data ?? []) as Chat[]} />;
}
