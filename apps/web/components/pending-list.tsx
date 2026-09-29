"use client";

import { Button, Modal } from "@heroui/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMessage } from "@/app/actions/messages";
import { formatDateTime } from "@/lib/format";
import type { ScheduledMessage } from "@/lib/types";

export function PendingList({ messages }: { messages: ScheduledMessage[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ScheduledMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!target) return;
    const id = target.id;
    setError(null);
    startTransition(async () => {
      const result = await cancelMessage(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTarget(null);
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted">No hay mensajes pendientes.</p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className="flex flex-col gap-3 rounded-lg border border-separator p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {message.chats?.name ?? "Chat eliminado"}
              </p>
              <p className="text-sm text-muted">
                {formatDateTime(message.scheduled_at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {message.message_body}
              </p>
            </div>
            <Button
              variant="danger-soft"
              onPress={() => {
                setError(null);
                setTarget(message);
              }}
            >
              Cancelar mensaje
            </Button>
          </li>
        ))}
      </ul>

      <Modal
        isOpen={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Cancelar mensaje</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>
                  El worker no enviará este mensaje. Esta acción no se puede
                  deshacer.
                </p>
                {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setTarget(null)}>
                  Volver
                </Button>
                <Button
                  variant="danger"
                  isDisabled={pending}
                  onPress={confirm}
                >
                  {pending ? "Cancelando..." : "Confirmar"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
