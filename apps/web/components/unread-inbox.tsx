"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshUnread } from "@/app/actions/worker";
import { formatDateTime } from "@/lib/format";
import type { Chat } from "@/lib/types";

const REFRESH_KEY = "soygerman-unread-refresh";
const REFRESH_WINDOW_MS = 15000;
let refreshedAt = 0;
let refreshInFlight = null;

function recentlyRefreshed() {
  const now = Date.now();
  if (now - refreshedAt < REFRESH_WINDOW_MS) return true;
  try {
    const last = Number(window.sessionStorage.getItem(REFRESH_KEY) || 0);
    if (now - last < REFRESH_WINDOW_MS) {
      refreshedAt = last;
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function markRefreshed() {
  refreshedAt = Date.now();
  try {
    window.sessionStorage.setItem(REFRESH_KEY, String(refreshedAt));
  } catch {
    return;
  }
}

function forgetRefresh() {
  refreshedAt = 0;
  try {
    window.sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    return;
  }
}

export function UnreadInbox({
  chats,
  total,
}: {
  chats: Chat[];
  total: number;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (recentlyRefreshed() || refreshInFlight) return;
    setRefreshing(true);
    refreshInFlight = refreshUnread()
      .then((result) => {
        if (result && "error" in result) {
          forgetRefresh();
          return;
        }
        markRefreshed();
        router.refresh();
      })
      .finally(() => {
        refreshInFlight = null;
        setRefreshing(false);
      });
  }, [router]);

  return (
    <section className="flex flex-col gap-3" aria-busy={refreshing}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sin leer</h2>
        {refreshing ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Loader2 className="animate-spin" size={14} aria-hidden />
            Actualizando
          </p>
        ) : total > 0 ? (
          <p className="text-sm text-muted">{total.toLocaleString("es-MX")}</p>
        ) : null}
      </div>
      {chats.length === 0 ? (
        <p className="text-sm text-muted">
          No hay conversaciones sin leer ni marcadas como no leídas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {chats.map((chat) => {
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
      {total > chats.length ? (
        <p className="text-sm text-muted">
          Hay {total - chats.length} conversaciones más sin leer.
        </p>
      ) : null}
    </section>
  );
}
