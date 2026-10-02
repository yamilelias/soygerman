"use client";

import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
  TimeField,
} from "@heroui/react";
import { getLocalTimeZone, now, type DateValue } from "@internationalized/date";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleMessage } from "@/app/actions/messages";
import type { Chat } from "@/lib/types";

export function ScheduleForm({ chats }: { chats: Chat[] }) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState<DateValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const minimum = now(getLocalTimeZone());

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
      setScheduledAt(null);
      router.refresh();
    });
  }

  if (chats.length === 0) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay chats. Ve a Configuración, conecta WhatsApp y sincroniza.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Select
        selectedKey={chatId}
        onSelectionChange={(key) => setChatId(key ? String(key) : null)}
        placeholder="Elige un chat o grupo"
      >
        <Label>Destino</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {chats.map((chat) => (
              <ListBox.Item
                key={chat.id}
                id={chat.id}
                textValue={`${chat.name} ${chat.is_group ? "Grupo" : "Directo"}`}
              >
                {chat.name} · {chat.is_group ? "Grupo" : "Directo"}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

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
