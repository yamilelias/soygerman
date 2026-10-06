"use client";

import { Button, Modal } from "@heroui/react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { dismissUnread } from "@/app/actions/chats";
import { loadChatPreview, refreshUnread } from "@/app/actions/worker";
import { formatDateTime } from "@/lib/format";
import type { Chat, ChatPreviewMessage } from "@/lib/types";

const REFRESH_KEY = "soygerman-unread-refresh";
const REFRESH_WINDOW_MS = 15000;
let refreshedAt = 0;
let refreshInFlight: Promise<void> | null = null;

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
  const [removed, setRemoved] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Chat | null>(null);
  const [previewMessages, setPreviewMessages] = useState<
    ChatPreviewMessage[] | null
  >(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const hiddenOnPage = chats.filter((chat) => removed.includes(chat.id)).length;
  const visible = chats.filter((chat) => !removed.includes(chat.id));
  const visibleTotal = Math.max(0, total - hiddenOnPage);

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

  function dismiss(chat: Chat) {
    setError(null);
    setBusyId(chat.id);
    setRemoved((current) =>
      current.includes(chat.id) ? current : [...current, chat.id],
    );
    void dismissUnread(chat.id).then((result) => {
      setBusyId(null);
      if ("error" in result) {
        setRemoved((current) => current.filter((id) => id !== chat.id));
        setError(result.error ?? "No se pudo quitar");
        return;
      }
      router.refresh();
    });
  }

  function openPreview(chat: Chat) {
    setPreview(chat);
    setPreviewMessages(null);
    setPreviewError(null);
    startPreview(async () => {
      const result = await loadChatPreview(chat.id);
      if ("error" in result) {
        setPreviewError(result.error ?? "No se pudo leer la conversación");
        setPreviewMessages([]);
        return;
      }
      setPreviewMessages(result.messages);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-busy={refreshing}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sin leer</h2>
        {refreshing ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Loader2 className="animate-spin" size={14} aria-hidden />
            Actualizando
          </p>
        ) : visibleTotal > 0 ? (
          <p className="text-sm text-muted">
            {visibleTotal.toLocaleString("es-MX")}
          </p>
        ) : null}
      </div>
      {visible.length === 0 ? (
        visibleTotal === 0 ? (
          <p className="text-sm text-muted">
            No hay conversaciones sin leer ni marcadas como no leídas.
          </p>
        ) : null
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((chat) => {
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
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => openPreview(chat)}
                  >
                    Ver
                  </Button>
                  <Link
                    href={`/schedule?chat=${chat.id}`}
                    className="rounded-md border border-separator px-3 py-1.5 text-sm font-medium"
                  >
                    Agendar
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={busyId === chat.id}
                    onPress={() => dismiss(chat)}
                  >
                    Quitar del inicio
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {visibleTotal > visible.length ? (
        <p className="text-sm text-muted">
          Hay {visibleTotal - visible.length} conversaciones más sin leer.
        </p>
      ) : null}

      <Modal
        isOpen={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  {preview?.name ?? "Conversación"}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {loadingPreview && previewMessages === null ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted">
                    <Loader2 className="animate-spin" size={14} aria-hidden />
                    Leyendo los últimos mensajes
                  </p>
                ) : null}
                {previewError ? (
                  <p className="text-sm text-danger">{previewError}</p>
                ) : null}
                {previewMessages && previewMessages.length > 0 ? (
                  <ul className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
                    {previewMessages.map((message, index) => (
                      <li key={`${message.at ?? "sin-fecha"}-${index}`}>
                        <p className="text-xs text-muted">
                          {message.fromMe
                            ? "Tú"
                            : message.sender || preview?.name || "Ellos"}
                          {message.at
                            ? ` · ${formatDateTime(message.at)}`
                            : ""}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">
                          {message.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {previewMessages && previewMessages.length === 0 && !previewError ? (
                  <p className="text-sm text-muted">
                    WhatsApp no devolvió mensajes recientes.
                  </p>
                ) : null}
                {preview?.last_message_preview &&
                previewMessages &&
                previewMessages.length === 0 ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {preview.last_message_from_me ? "Tú: " : ""}
                    {preview.last_message_preview}
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setPreview(null)}>
                  Cerrar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
