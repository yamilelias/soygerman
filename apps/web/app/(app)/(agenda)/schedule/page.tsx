import { ScheduleForm } from "@/components/schedule-form";
import { getChat, searchChats } from "@/lib/chats";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const params = await searchParams;
  const chatId = typeof params.chat === "string" ? params.chat : "";
  const [{ total }, selected] = await Promise.all([
    searchChats({ pageSize: 1 }),
    chatId ? getChat(chatId) : Promise.resolve(null),
  ]);

  return (
    <div className="w-full max-w-xl">
      {total === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay chats. Ve a Configuración y conecta WhatsApp. La lista
          llega sola.
        </p>
      ) : (
        <ScheduleForm selected={selected} />
      )}
    </div>
  );
}
