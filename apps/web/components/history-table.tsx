"use client";

import { Button, Chip, Modal, Table } from "@heroui/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleFutureMessages } from "@/app/actions/messages";
import { HistoryDestinationPicker } from "@/components/history-destination-picker";
import { formatDateTime } from "@/lib/format";
import type { Chat, MessageStatus, ScheduledMessage } from "@/lib/types";

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

export function HistoryTable({ messages, futureIds }: { messages: ScheduledMessage[]; futureIds: string[] }) {
  const router = useRouter();
  const candidates = messages.filter((message) => futureIds.includes(message.id));
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, Chat>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const missingIds = selectedIds.filter((id) => {
    const message = candidates.find((candidate) => candidate.id === id);
    return message && !message.destination_wa_id && !message.chat_id && !destinations[id];
  });

  function confirm() {
    if (missingIds.length) {
      setError(`Elige destino para ${missingIds.length} mensaje${missingIds.length === 1 ? "" : "s"}.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rescheduleFutureMessages(selectedIds.map((id) => ({
        id,
        chatId: destinations[id]?.id,
      })));
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setNotice(result.count ? `${result.count} mensaje${result.count === 1 ? "" : "s"} reagendado${result.count === 1 ? "" : "s"}.` : "Los mensajes seleccionados ya estaban reagendados.");
      router.refresh();
    });
  }
  if (messages.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay envíos.</p>;
  }

  return (
    <>
      {candidates.length ? (
        <Button variant="secondary" onPress={() => {
          setSelectedIds(candidates.map((message) => message.id));
          setDestinations({});
          setError(null);
          setOpen(true);
        }}>
          Reagendar mensajes futuros
        </Button>
      ) : null}
      {notice ? <p className="text-sm text-success">{notice}</p> : null}
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
                <Table.Cell>
                  {message.chats?.name ?? message.destination_name ?? "Chat eliminado"}
                  {message.sender_phone_number ? (
                    <span className="block text-xs text-muted">Desde {message.sender_phone_number}</span>
                  ) : null}
                </Table.Cell>
                <Table.Cell>{formatDateTime(message.scheduled_at)}</Table.Cell>
                <Table.Cell>
                  <Chip color={colors[message.status]} variant="soft" size="sm">
                    {labels[message.status]}
                  </Chip>
                  {message.status === "failed" && message.error_message ? (
                    <p className="mt-1 text-xs text-danger">{message.error_message}</p>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  <span className="line-clamp-3 whitespace-pre-wrap">
                    {message.message_body}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {message.status === "sent" || message.status === "failed" || message.status === "cancelled" ? (
                    <Button size="sm" variant="secondary" onPress={() => router.push(`/schedule?copy=${message.id}`)}>
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
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header><Modal.Heading>Reagendar mensajes futuros</Modal.Heading></Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">Se crearán pendientes con la fecha, hora y texto originales.</p>
                <label className="mt-3 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={candidates.length > 0 && selectedIds.length === candidates.length}
                    onChange={(event) => setSelectedIds(event.target.checked ? candidates.map((message) => message.id) : [])} />
                  Seleccionar todos
                </label>
                <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-separator">
                  {candidates.map((message) => {
                    const needsDestination = !message.destination_wa_id && !message.chat_id;
                    return <div key={message.id} className="flex gap-3 border-b border-separator p-3 last:border-b-0">
                      <input type="checkbox" aria-label={`Seleccionar mensaje para ${message.destination_name ?? message.chats?.name ?? "chat eliminado"}`}
                        checked={selectedIds.includes(message.id)}
                        onChange={(event) => setSelectedIds((current) => event.target.checked
                          ? [...current, message.id] : current.filter((id) => id !== message.id))} />
                      <div className="min-w-0 flex-1 text-sm">
                        <span className="block font-medium">{message.chats?.name ?? message.destination_name ?? "Chat eliminado"}</span>
                        <span className="block text-muted">{formatDateTime(message.scheduled_at)}</span>
                        <span className="block truncate">{message.message_body}</span>
                        {needsDestination && selectedIds.includes(message.id) ? (
                          <div className="mt-2">
                            <HistoryDestinationPicker value={destinations[message.id] ?? null}
                              onChange={(chat) => setDestinations((current) => {
                                const next = { ...current };
                                if (chat) next[message.id] = chat;
                                else delete next[message.id];
                                return next;
                              })} />
                            {destinations[message.id] ? (
                              <button type="button" className="mt-1 text-xs text-primary underline"
                                onClick={() => {
                                  const chat = destinations[message.id];
                                  setDestinations((current) => Object.fromEntries(candidates
                                    .filter((candidate) => !candidate.destination_wa_id && !candidate.chat_id)
                                    .map((candidate) => [candidate.id, current[candidate.id] ?? chat])));
                                }}>
                                Usar este destino en los demás sin destino
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>;
                  })}
                </div>
                {missingIds.length ? (
                  <p className="mt-2 text-sm text-muted">
                    Elige {missingIds.length} destino{missingIds.length === 1 ? "" : "s"} para continuar. Los mensajes anteriores a la desconexión no conservaron el chat original.
                  </p>
                ) : null}
                {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setOpen(false)}>Volver</Button>
                <Button isDisabled={pending || selectedIds.length === 0 || missingIds.length > 0} onPress={confirm}>
                  {pending ? "Reagendando..." : `Reagendar ${selectedIds.length}`}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
