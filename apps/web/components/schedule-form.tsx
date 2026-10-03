"use client";

import {
  Button,
  Calendar,
  ComboBox,
  DateField,
  DatePicker,
  Input,
  Label,
  ListBox,
  TextArea,
  TextField,
  TimeField,
} from "@heroui/react";
import { getLocalTimeZone, now, type DateValue } from "@internationalized/date";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchChats } from "@/app/actions/chats";
import { scheduleMessage } from "@/app/actions/messages";
import { chatLabel } from "@/lib/phone";
import type { Chat } from "@/lib/types";

function defaultWhen() {
  return now(getLocalTimeZone()).add({ days: 1 });
}

export function ScheduleForm({ selected }: { selected: Chat | null }) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(selected?.id ?? null);
  const [input, setInput] = useState(selected ? chatLabel(selected) : "");
  const [options, setOptions] = useState<Chat[]>(selected ? [selected] : []);
  const [searching, setSearching] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<DateValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const pickedLabel = useRef(selected ? chatLabel(selected) : "");
  const requestId = useRef(0);
  const minimum = now(getLocalTimeZone());

  useEffect(() => {
    setScheduledAt((current) => current ?? defaultWhen());
  }, []);

  function onInputChange(value: string) {
    setInput(value);
    if (value === pickedLabel.current) return;
    setChatId(null);
    const text = value.trim();
    const current = ++requestId.current;
    if (text.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    window.setTimeout(() => {
      if (current !== requestId.current) return;
      void searchChats(text).then((chats) => {
        if (current !== requestId.current) return;
        setOptions(chats);
        setSearching(false);
      });
    }, 250);
  }

  function onSelectionChange(key: string | number | null) {
    const id = key == null ? null : String(key);
    setChatId(id);
    const chat =
      options.find((item) => item.id === id) ??
      (selected?.id === id ? selected : null);
    const label = chat ? chatLabel(chat) : "";
    pickedLabel.current = label;
    setInput(label);
  }

  function submit() {
    setError(null);
    setDone(false);
    if (!scheduledAt) {
      setError("Elige fecha y hora");
      return;
    }
    const when = scheduledAt.toDate(getLocalTimeZone());
    startTransition(async () => {
      const result = await scheduleMessage({
        chatId: chatId ?? "",
        messageBody,
        scheduledAt: when.toISOString(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      setMessageBody("");
      setScheduledAt(defaultWhen());
      router.refresh();
    });
  }

  const hint =
    input.trim().length < 2
      ? "Escribe un nombre o número."
      : searching
        ? "Buscando..."
        : "Ningún chat coincide.";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ComboBox
        fullWidth
        menuTrigger="focus"
        items={options}
        selectedKey={chatId}
        inputValue={input}
        onInputChange={onInputChange}
        onSelectionChange={onSelectionChange}
        allowsEmptyCollection
        defaultFilter={() => true}
      >
        <Label>Destino</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Nombre o número" />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() => (
              <p className="px-3 py-2 text-sm text-muted">{hint}</p>
            )}
          >
            {(chat: Chat) => (
              <ListBox.Item id={chat.id} textValue={chatLabel(chat)}>
                {chatLabel(chat)}
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      <TextField value={messageBody} onChange={setMessageBody}>
        <Label>Mensaje</Label>
        <TextArea placeholder="Escribe el mensaje que se enviará" />
      </TextField>

      <DatePicker
        granularity="minute"
        value={scheduledAt}
        onChange={setScheduledAt}
        minValue={minimum}
        hideTimeZone
        shouldCloseOnSelect={false}
      >
        {({ state }) => (
          <>
            <Label>Fecha y hora</Label>
            <DateField.Group>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Group>
            <DatePicker.Popover className="flex flex-col gap-3">
              <Calendar aria-label="Fecha de envío">
                <Calendar.Header>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.Heading />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>
                    {(date) => <Calendar.Cell date={date} />}
                  </Calendar.GridBody>
                </Calendar.Grid>
              </Calendar>
              <div className="flex items-center justify-between gap-3">
                <Label>Hora</Label>
                <TimeField
                  aria-label="Hora"
                  granularity="minute"
                  hideTimeZone
                  value={state.timeValue}
                  onChange={(value) => {
                    if (value) state.setTimeValue(value);
                  }}
                >
                  <TimeField.Group variant="secondary">
                    <TimeField.Input>
                      {(segment) => <TimeField.Segment segment={segment} />}
                    </TimeField.Input>
                  </TimeField.Group>
                </TimeField>
              </div>
            </DatePicker.Popover>
          </>
        )}
      </DatePicker>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {done ? (
        <p className="text-sm text-success">Mensaje agendado.</p>
      ) : null}

      <Button type="submit" isDisabled={pending}>
        {pending ? "Guardando..." : "Agendar mensaje"}
      </Button>
    </form>
  );
}
