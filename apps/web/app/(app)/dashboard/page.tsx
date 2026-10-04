import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { Chat, DailyDigest, DigestItem, ScheduledMessage } from "@/lib/types";
import { currentWeekInMexico, formatWeekRange, mexicoDateString } from "@/lib/week";
import { createClient } from "@/utils/supabase/server";

const unreadColumns =
  "id, user_id, wa_id, name, is_group, updated_at, unread_count, marked_unread, unread_since, last_message_at, last_message_preview, last_message_from_me";

const UNREAD_LIMIT = 40;

const messageColumns =
  "id, user_id, chat_id, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)";

export default async function DashboardPage() {
  const supabase = await createClient();
  const week = currentWeekInMexico();

  const [pendingResult, sentResult, failedResult, unreadResult, digestResult] =
    await Promise.all([
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
    supabase
      .from("chats")
      .select(unreadColumns, { count: "exact" })
      .eq("hidden", false)
      .eq("archived", false)
      .or("unread_count.gt.0,marked_unread.eq.true")
      .order("unread_since", { ascending: true, nullsFirst: false })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(UNREAD_LIMIT),
    supabase
      .from("daily_digests")
      .select(
        "id, user_id, digest_date, status, overview, items, error_message, model, created_at, updated_at",
      )
      .eq("digest_date", mexicoDateString())
      .maybeSingle(),
  ]);

  if (unreadResult.error) throw new Error(unreadResult.error.message);
  if (digestResult.error) throw new Error(digestResult.error.message);

  const upcoming = (pendingResult.data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });
  const pendingCount = pendingResult.count ?? upcoming.length;
  const unread = (unreadResult.data ?? []) as Chat[];
  const unreadCount = unreadResult.count ?? unread.length;
  const digest = (digestResult.data ?? null) as DailyDigest | null;
  const digestItems = Array.isArray(digest?.items)
    ? (digest.items as DigestItem[])
    : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted">
          El resumen de hoy, conversaciones sin leer y lo de esta semana.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Para hoy</h2>
        <TodayDigest digest={digest} items={digestItems} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sin leer</h2>
          {unreadCount > 0 ? (
            <p className="text-sm text-muted">
              {unreadCount.toLocaleString("es-MX")}
            </p>
          ) : null}
        </div>
        {unread.length === 0 ? (
          <p className="text-sm text-muted">
            No hay conversaciones sin leer ni marcadas como no leídas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {unread.map((chat) => {
              const waiting = chat.unread_count ?? 0;
              return (
                <li
                  key={chat.id}
                  className="flex flex-col gap-3 rounded-lg border border-separator p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{chat.name}</p>
                    <p className="text-sm text-muted">
                      {waiting > 0
                        ? `${waiting.toLocaleString("es-MX")} sin leer`
                        : "Marcada como no leída"}
                      {waiting > 0 && chat.marked_unread
                        ? " · marcada como no leída"
                        : ""}
                      {chat.unread_since
                        ? ` · desde ${formatDateTime(chat.unread_since)}`
                        : ""}
                    </p>
                    {chat.last_message_preview ? (
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">
                        {chat.last_message_from_me ? "Tú: " : ""}
                        {chat.last_message_preview}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Sin texto del último mensaje.
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/schedule?chat=${chat.id}`}
                    className="shrink-0 text-sm font-medium"
                  >
                    Agendar
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {unreadCount > unread.length ? (
          <p className="text-sm text-muted">
            Hay {unreadCount - unread.length} conversaciones más sin leer.
          </p>
        ) : null}
      </section>

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

function TodayDigest({
  digest,
  items,
}: {
  digest: DailyDigest | null;
  items: DigestItem[];
}) {
  if (!digest) {
    return (
      <p className="text-sm text-muted">El resumen sale a las 6:00.</p>
    );
  }
  if (digest.status === "running") {
    return (
      <p className="text-sm text-muted">
        El resumen de hoy se está preparando.
      </p>
    );
  }
  if (digest.status === "failed") {
    return (
      <p className="text-sm text-muted">
        {digest.error_message || "No se pudo preparar el resumen."}
      </p>
    );
  }
  if (digest.status === "empty") {
    return (
      <p className="text-sm text-muted">
        No hay conversaciones sin leer para resumir.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Generado {formatDateTime(digest.updated_at)}
      </p>
      {digest.overview ? (
        <p className="whitespace-pre-wrap text-sm">{digest.overview}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          No hay actividades pendientes en los chats sin leer.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.chat_id}
              className="flex flex-col gap-3 rounded-lg border border-separator p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{item.action}</p>
              </div>
              <Link
                href={`/schedule?chat=${item.chat_id}`}
                className="shrink-0 text-sm font-medium"
              >
                Agendar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
