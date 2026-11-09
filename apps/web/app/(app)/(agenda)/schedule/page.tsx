import { ScheduleForm } from "@/components/schedule-form";
import { getChat, searchChats } from "@/lib/chats";
import { activeLine } from "@/lib/lines";
import { createClient } from "@/utils/supabase/server";
import type { ScheduledMessage } from "@/lib/types";

function currentTime() {
  return Date.now();
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string; edit?: string; copy?: string }>;
}) {
  const params = await searchParams;
  const chatId = typeof params.chat === "string" ? params.chat : "";
  const line = await activeLine();
  const messageId = typeof params.edit === "string" ? params.edit :
    typeof params.copy === "string" ? params.copy : "";
  const supabase = await createClient();
  const [{ total }, messageResult] = await Promise.all([
    searchChats({ pageSize: 1 }),
    messageId && line
      ? supabase.from("scheduled_messages")
        .select("id, user_id, session_id, sender_phone_number, chat_id, destination_wa_id, destination_name, message_body, scheduled_at, status, error_message, created_at")
        .eq("id", messageId).eq("session_id", line.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const message = messageResult.data as ScheduledMessage | null;
  const mode = params.edit ? "edit" : params.copy ? "copy" : "new";
  const validMessage = message && (
    (mode === "edit" && message.status === "pending") ||
    (mode === "copy" && (message.status === "failed" || message.status === "sent" || message.status === "cancelled"))
  ) ? message : null;
  const selected = await getChat(validMessage?.chat_id ?? chatId);
  const recovered = !selected && validMessage?.destination_wa_id && line
    ? await supabase.from("chats").select("id").eq("session_id", line.id)
      .eq("wa_id", validMessage.destination_wa_id).eq("hidden", false).maybeSingle()
    : null;
  const destination = selected ?? (recovered?.data ? await getChat(recovered.data.id) : null);

  return (
    <div className="w-full max-w-xl">
      {mode !== "new" && !validMessage ? (
        <p className="text-sm text-danger">El mensaje ya no está disponible para esta acción.</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay chats. Ve a Configuración y conecta WhatsApp. La lista
          llega sola.
        </p>
      ) : (
        <ScheduleForm key={`${line?.id}-${messageId}`} selected={destination} message={validMessage} mode={mode}
          copyFuture={mode === "copy" && Boolean(validMessage && new Date(validMessage.scheduled_at).getTime() > currentTime())} />
      )}
    </div>
  );
}
