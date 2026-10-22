import { PendingList } from "@/components/pending-list";
import type { ScheduledMessage } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { activeLine } from "@/lib/lines";

export default async function PendingPage() {
  const supabase = await createClient();
  const line = await activeLine();
  if (!line) return <PendingList messages={[]} />;
  const { data } = await supabase
    .from("scheduled_messages")
    .select(
      "id, user_id, session_id, sender_phone_number, chat_id, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)",
    )
    .eq("status", "pending")
    .eq("session_id", line.id)
    .order("scheduled_at", { ascending: true });

  const messages = (data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });

  return <PendingList key={line.id} messages={messages} />;
}
