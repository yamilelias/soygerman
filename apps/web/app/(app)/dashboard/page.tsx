import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { ScheduledMessage } from "@/lib/types";
import { currentWeekInMexico, formatWeekRange } from "@/lib/week";
import { createClient } from "@/utils/supabase/server";

const messageColumns =
  "id, user_id, chat_id, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)";

export default async function DashboardPage() {
  const supabase = await createClient();
  const week = currentWeekInMexico();

  const [pendingResult, sentResult, failedResult] = await Promise.all([
    supabase
      .from("scheduled_messages")
      .select(messageColumns, { count: "exact" })
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true })
      .limit(8),
    supabase
      .from("scheduled_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("scheduled_at", week.start.toISOString())
      .lt("scheduled_at", week.end.toISOString()),
    supabase
      .from("scheduled_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  const upcoming = (pendingResult.data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });
  const pendingCount = pendingResult.count ?? upcoming.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted">
          Mensajes por enviar, enviados esta semana y fallidos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-separator p-4">
          <p className="text-sm text-muted">Enviados esta semana</p>
          <p className="text-3xl font-semibold">{sentResult.count ?? 0}</p>
          <p className="text-sm text-muted">
            {formatWeekRange(week.start, week.end)}
          </p>
        </section>
        <section className="rounded-lg border border-separator p-4">
          <p className="text-sm text-muted">Fallidos hasta ahora</p>
          <p className="text-3xl font-semibold">{failedResult.count ?? 0}</p>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Por enviar</h2>
          <Link href="/pending" className="text-sm text-muted">
            Ver pendientes
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">No hay mensajes agendados.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((message) => (
              <li
                key={message.id}
                className="rounded-lg border border-separator p-4"
              >
                <p className="font-medium">
                  {message.chats?.name ?? "Chat eliminado"}
                </p>
                <p className="text-sm text-muted">
                  {formatDateTime(message.scheduled_at)}
                </p>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm">
                  {message.message_body}
                </p>
              </li>
            ))}
          </ul>
        )}
        {pendingCount > upcoming.length ? (
          <p className="text-sm text-muted">
            Hay {pendingCount - upcoming.length} más en pendientes.
          </p>
        ) : null}
      </section>
    </div>
  );
}
