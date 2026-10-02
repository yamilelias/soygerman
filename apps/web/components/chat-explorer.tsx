"use client";

import { Chip, Input, Label, Tabs, TextField } from "@heroui/react";
import { useState } from "react";
import type { Chat } from "@/lib/types";

type Filter = "all" | "groups" | "direct";

export function ChatExplorer({ chats }: { chats: Chat[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = chats.filter((chat) => {
    const matchesName = chat.name
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    if (!matchesName) return false;
    if (filter === "groups") return chat.is_group;
    if (filter === "direct") return !chat.is_group;
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Chats y grupos</h1>
        <p className="text-sm text-muted">
          Conversaciones sincronizadas desde WhatsApp. Aquí no aparece el
          historial de mensajes.
        </p>
      </div>

      <TextField value={query} onChange={setQuery}>
        <Label>Buscar</Label>
        <Input placeholder="Nombre del chat o grupo" />
      </TextField>

      <Tabs
        selectedKey={filter}
        onSelectionChange={(key) => setFilter(String(key) as Filter)}
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

      {visible.length === 0 ? (
        <p className="text-sm text-muted">
          No hay chats para mostrar. Vincula WhatsApp y sincroniza desde
          Configuración.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((chat) => (
            <li
              key={chat.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-separator px-3 py-3"
            >
              <span className="truncate font-medium">{chat.name}</span>
              <Chip
                size="sm"
                variant="soft"
                color={chat.is_group ? "accent" : "default"}
              >
                {chat.is_group ? "Grupo" : "Directo"}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
