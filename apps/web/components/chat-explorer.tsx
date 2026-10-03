"use client";

import { Button, Chip, Input, Label, Tabs, TextField } from "@heroui/react";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteChat } from "@/app/actions/chats";
import { CHAT_PAGE_SIZE, type ChatKind } from "@/lib/chat-list";
import { formatPhone } from "@/lib/phone";
import type { Chat } from "@/lib/types";

function chatsHref(query: string, kind: ChatKind, page: number) {
  const params = new URLSearchParams();
  const text = query.trim();
  if (text) params.set("q", text);
  if (kind !== "all") params.set("kind", kind);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/chats?${search}` : "/chats";
}

export function ChatExplorer({
  chats,
  total,
  query,
  kind,
  page,
}: {
  chats: Chat[];
  total: number;
  query: string;
  kind: ChatKind;
  page: number;
}) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pageCount = Math.max(1, Math.ceil(total / CHAT_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * CHAT_PAGE_SIZE + 1;
  const to = Math.min(page * CHAT_PAGE_SIZE, total);

  useEffect(() => {
    setText(query);
  }, [query]);

  useEffect(() => {
    if (text === query) return;
    const handle = setTimeout(() => {
      router.replace(chatsHref(text, kind, 1));
    }, 300);
    return () => clearTimeout(handle);
  }, [text, query, kind, router]);

  function remove(chat: Chat) {
    const label = chat.name || "este chat";
    const confirmed = window.confirm(
      `¿Quitar ${label} de la lista? Los recordatorios pendientes de este chat se cancelan.`,
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteChat(chat.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Chats y grupos</h1>
        <p className="text-sm text-muted">
          {total.toLocaleString("es-MX")}{" "}
          {total === 1 ? "conversación" : "conversaciones"}
          {query.trim() ? " coinciden con la búsqueda." : " sincronizadas."}{" "}
          {total > 0
            ? `Mostrando ${from.toLocaleString("es-MX")}–${to.toLocaleString("es-MX")}.`
            : "Aquí no aparece el historial de mensajes."}
        </p>
      </div>

      <TextField value={text} onChange={setText}>
        <Label>Buscar</Label>
        <Input placeholder="Nombre o número" />
      </TextField>

      <Tabs
        selectedKey={kind}
        onSelectionChange={(key) => {
          router.replace(chatsHref(text, String(key) as ChatKind, 1));
        }}
      >
        <Tabs.List aria-label="Filtrar chats">
          <Tabs.Tab id="all">
            Todos
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="groups">
            Grupos
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="direct">
            Directos
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {chats.length === 0 ? (
        <p className="text-sm text-muted">
          {total === 0 && !query.trim() && kind === "all"
            ? "No hay chats para mostrar. Los que quitas no vuelven al sincronizar."
            : "Ningún chat coincide."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chats.map((chat) => {
            const phone = formatPhone(chat.wa_id);
            return (
              <li
                key={chat.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-separator px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{chat.name}</p>
                  {phone ? (
                    <p className="truncate text-sm text-muted">{phone}</p>
                  ) : !chat.is_group ? (
                    <p className="truncate text-sm text-muted">Sin número</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={chat.is_group ? "accent" : "default"}
                  >
                    {chat.is_group ? "Grupo" : "Directo"}
                  </Chip>
                  <Link
                    href={`/schedule?chat=${chat.id}`}
                    className="rounded-md border border-separator px-3 py-1.5 text-sm font-medium"
                  >
                    Agendar
                  </Link>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    aria-label={`Quitar ${chat.name}`}
                    isDisabled={pending}
                    onPress={() => remove(chat)}
                  >
                    <Trash2 size={16} />
                    Quitar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link href={chatsHref(query, kind, page - 1)}>Anterior</Link>
          ) : (
            <span className="text-muted">Anterior</span>
          )}
          <span className="text-muted">
            Página {page.toLocaleString("es-MX")} de{" "}
            {pageCount.toLocaleString("es-MX")}
          </span>
          {page < pageCount ? (
            <Link href={chatsHref(query, kind, page + 1)}>Siguiente</Link>
          ) : (
            <span className="text-muted">Siguiente</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
