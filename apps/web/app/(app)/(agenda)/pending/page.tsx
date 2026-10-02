import { PendingList } from "@/components/pending-list";
import type { ScheduledMessage } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_messages")
    .select(
      "id, user_id, chat_id, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)",
    )
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true });

  const messages = (data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });

  return <PendingList messages={messages} />;
}
