"use client";

import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useRef, useState } from "react";
import { searchChats } from "@/app/actions/chats";
import { chatLabel } from "@/lib/phone";
import type { Chat } from "@/lib/types";

export function HistoryDestinationPicker({ value, onChange }: {
  value: Chat | null;
  onChange: (chat: Chat | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Chat[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  function search(text: string) {
    setQuery(text);
    if (text === (value ? chatLabel(value) : "")) return;
    onChange(null);
    const request = ++requestId.current;
    if (text.trim().length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    window.setTimeout(() => {
      if (request !== requestId.current) return;
      void searchChats(text).then((chats) => {
        if (request !== requestId.current) return;
        setOptions(chats);
        setSearching(false);
      });
    }, 250);
  }

  return (
    <ComboBox
      fullWidth
      menuTrigger="focus"
      items={value && !options.some((chat) => chat.id === value.id) ? [value, ...options] : options}
      selectedKey={value?.id ?? null}
      inputValue={value ? chatLabel(value) : query}
      onInputChange={search}
      onSelectionChange={(key) => {
        const chat = options.find((item) => item.id === String(key));
        if (chat) {
          setQuery("");
          onChange(chat);
        }
      }}
      allowsEmptyCollection
      defaultFilter={() => true}
    >
      <Label>Destino</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Buscar nombre o número" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => (
          <p className="px-3 py-2 text-sm text-muted">
            {searching ? "Buscando..." : "Escribe al menos dos caracteres para buscar."}
          </p>
        )}>
          {(chat: Chat) => (
            <ListBox.Item id={chat.id} textValue={chatLabel(chat)}>
              {chatLabel(chat)}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
