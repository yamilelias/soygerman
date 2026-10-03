"use client";

import {
  Button,
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Label,
  Modal,
  Table,
  TimeField,
} from "@heroui/react";
import { getLocalTimeZone, now, type DateValue } from "@internationalized/date";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleMessage } from "@/app/actions/messages";
import { formatDateTime } from "@/lib/format";
import type { MessageStatus, ScheduledMessage } from "@/lib/types";

const labels: Record<MessageStatus, string> = {
  pending: "Pendiente",
  processing: "Enviando",
  sent: "Enviado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

const colors = {
  sent: "success",
  failed: "danger",
  cancelled: "default",
  pending: "warning",
  processing: "warning",
} as const;

function canReschedule(status: MessageStatus) {
  return status === "sent" || status === "failed";
}

function defaultWhen() {
  return now(getLocalTimeZone()).add({ days: 1 });
}

export function HistoryTable({ messages }: { messages: ScheduledMessage[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ScheduledMessage | null>(null);
  const [scheduledAt, setScheduledAt] = useState<DateValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const minimum = now(getLocalTimeZone());

  function open(message: ScheduledMessage) {
    setError(null);
    setScheduledAt(defaultWhen());
    setTarget(message);
  }

  function close() {
    if (pending) return;
    setTarget(null);
    setError(null);
  }

  function confirm() {
    if (!target) return;
    if (!scheduledAt) {
      setError("Elige fecha y hora");
      return;
    }
    const id = target.id;
    const when = scheduledAt.toDate(getLocalTimeZone());
    setError(null);
    startTransition(async () => {
      const result = await rescheduleMessage({
        id,
        scheduledAt: when.toISOString(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setTarget(null);
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay envíos.</p>;
  }

  return (
    <>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Historial de mensajes">
            <Table.Header>
              <Table.Column isRowHeader>Destino</Table.Column>
              <Table.Column>Fecha</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Mensaje</Table.Column>
              <Table.Column>Acciones</Table.Column>
            </Table.Header>
            <Table.Body>
              {messages.map((message) => (
                <Table.Row key={message.id} id={message.id}>
                  <Table.Cell>{message.chats?.name ?? "Chat eliminado"}</Table.Cell>
                  <Table.Cell>{formatDateTime(message.scheduled_at)}</Table.Cell>
                  <Table.Cell>
                    <Chip color={colors[message.status]} variant="soft" size="sm">
                      {labels[message.status]}
                    </Chip>
                    {message.status === "failed" && message.error_message ? (
                      <p className="mt-1 text-xs text-danger">
                        {message.error_message}
                      </p>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="line-clamp-3 whitespace-pre-wrap">
                      {message.message_body}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {canReschedule(message.status) ? (
                      <Button size="sm" variant="secondary" onPress={() => open(message)}>
                        Reagendar
                      </Button>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Modal
        isOpen={target !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Reagendar mensaje</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  Se crea una copia para{" "}
                  {target?.chats?.name ?? "el mismo chat"}. El mensaje original
                  se queda en el historial.
                </p>
                {target ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {target.message_body}
                  </p>
                ) : null}
                <div className="mt-4">
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
                        <Label>Nueva fecha y hora</Label>
                        <DateField.Group>
                          <DateField.Input>
                            {(segment) => <DateField.Segment segment={segment} />}
                          </DateField.Input>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Group>
                        <DatePicker.Popover className="flex flex-col gap-3">
                          <Calendar aria-label="Nueva fecha de envío">
                            <Calendar.Header>
                              <Calendar.NavButton slot="previous" />
                              <Calendar.Heading />
                              <Calendar.NavButton slot="next" />
                            </Calendar.Header>
                            <Calendar.Grid>
                              <Calendar.GridHeader>
                                {(day) => (
                                  <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                                )}
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
                                  {(segment) => (
                                    <TimeField.Segment segment={segment} />
                                  )}
                                </TimeField.Input>
                              </TimeField.Group>
                            </TimeField>
                          </div>
                        </DatePicker.Popover>
                      </>
                    )}
                  </DatePicker>
                </div>
                {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={close}>
                  Volver
                </Button>
                <Button isDisabled={pending} onPress={confirm}>
                  {pending ? "Guardando..." : "Crear copia"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
