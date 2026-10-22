import Link from "next/link";
import { FailedMessagesToast } from "@/components/failed-messages-toast";
import { UnreadInbox } from "@/components/unread-inbox";
import { formatDateTime } from "@/lib/format";
import type { Chat, DailyDigest, ScheduledMessage } from "@/lib/types";
import { currentDayInMexico, currentWeekInMexico, formatWeekRange, mexicoDateString } from "@/lib/week";
import { createClient } from "@/utils/supabase/server";

const unreadColumns =
  "id, user_id, wa_id, name, is_group, updated_at, unread_count, marked_unread, unread_since, last_message_at, last_message_preview, last_message_from_me";

const UNREAD_LIMIT = 40;

const messageColumns =
  "id, user_id, chat_id, message_body, scheduled_at, status, error_message, created_at, chats(name, is_group)";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const today = currentDayInMexico();
  const week = currentWeekInMexico();

  const [pendingResult, sentResult, failedResult, unreadResult, digestResult, weekPending] =
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
      .eq("inbox_visible", true)
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
    loadWeekPending(supabase, today.start, week.end),
  ]);

  if (unreadResult.error) throw new Error(unreadResult.error.message);
  if (digestResult.error) throw new Error(digestResult.error.message);

  const upcoming = (pendingResult.data ?? []).map((row) => {
    const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
    return { ...row, chats: chat ?? null } as ScheduledMessage;
  });
  const pendingCount = pendingResult.count ?? upcoming.length;
  const todayPending = weekPending.filter(
    (message) => new Date(message.scheduled_at) < today.end,
  );
  const unread = (unreadResult.data ?? []) as Chat[];
  const unreadCount = unreadResult.count ?? unread.length;
  const digest = (digestResult.data ?? null) as DailyDigest | null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {user ? (
        <FailedMessagesToast
          userId={user.id}
          initialCount={failedResult.count ?? 0}
        />
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted">
          El resumen de hoy, conversaciones sin leer y lo de esta semana.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Para hoy</h2>
        <TodayDigest digest={digest} />
      </section>

      <UnreadInbox chats={unread} total={unreadCount} />

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-separator p-4">
          <p className="text-sm text-muted">Por enviar hoy</p>
          <p className="text-3xl font-semibold">{todayPending.length}</p>
          {todayPending.length === 0 ? (
            <p className="text-sm text-muted">No hay mensajes pendientes para hoy.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {todayPending.map((message) => (
                <li key={message.id} className="flex justify-between gap-3">
                  <span>{message.chats?.name ?? "Chat eliminado"}</span>
                  <span className="shrink-0 text-muted">
                    {formatTime(message.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-separator p-4">
          <p className="text-sm text-muted">Por enviar esta semana</p>
          <p className="text-3xl font-semibold">{weekPending.length}</p>
          <p className="text-sm text-muted">
            {formatWeekRange(week.start, week.end)}
          </p>
          {weekPending.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No hay mensajes pendientes para esta semana.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {weekPending.map((message) => (
                <li key={message.id} className="flex justify-between gap-3">
                  <span>{message.chats?.name ?? "Chat eliminado"}</span>
                  <span className="shrink-0 text-muted">
                    {formatMexicoDateTime(message.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
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

async function loadWeekPending(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: Date,
  end: Date,
) {
  const messages: ScheduledMessage[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("scheduled_messages")
      .select(messageColumns)
      .eq("status", "pending")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    messages.push(
      ...(data ?? []).map((row) => {
        const chat = Array.isArray(row.chats) ? row.chats[0] : row.chats;
        return { ...row, chats: chat ?? null } as ScheduledMessage;
      }),
    );
    if (!data || data.length < pageSize) break;
  }
  return messages;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatMexicoDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function TodayDigest({ digest }: { digest: DailyDigest | null }) {
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
    </div>
  );
}
