"use client";

import { Button, Chip, Table } from "@heroui/react";
import { useRouter } from "next/navigation";
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

export function HistoryTable({ messages }: { messages: ScheduledMessage[] }) {
  const router = useRouter();
  if (messages.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay envíos.</p>;
  }

  return (
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
                  {message.chats?.name ?? "Chat eliminado"}
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
                  {message.status === "sent" || message.status === "failed" ? (
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
  );
}
