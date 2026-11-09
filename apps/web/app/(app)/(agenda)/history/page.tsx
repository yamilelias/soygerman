import { HistoryTable } from "@/components/history-table";
import type { ScheduledMessage } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { activeLine } from "@/lib/lines";

function currentTime() {
  return Date.now();
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const line = await activeLine();
  if (!line) return <HistoryTable messages={[]} futureIds={[]} />;
  const { data } = await supabase
    .from("scheduled_messages")
    .select(
      "id, user_id, session_id, sender_phone_number, chat_id, destination_wa_id, destination_name, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)",
    )
    .in("status", ["sent", "failed", "cancelled"])
    .eq("session_id", line.id)
    .order("scheduled_at", { ascending: false });

  const messages = (data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });

  const now = currentTime();
  const futureIds = messages.filter((message) =>
    (message.status === "failed" || message.status === "cancelled") &&
    new Date(message.scheduled_at).getTime() > now,
  ).map((message) => message.id);

  return <HistoryTable key={line.id} messages={messages} futureIds={futureIds} />;
}
