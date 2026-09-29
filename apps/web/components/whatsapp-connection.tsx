"use client";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useEffect, useState, useTransition } from "react";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  syncChats,
} from "@/app/actions/worker";
import type { WhatsAppSession } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";

const statusLabel = {
  disconnected: "Desconectado",
  qr_ready: "Esperando escaneo",
  connected: "Conectado",
} as const;

const statusColor = {
  disconnected: "default",
  qr_ready: "warning",
  connected: "success",
} as const;

export function WhatsAppConnection() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("id, user_id, status, qr_code_base64, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (active) {
        setSession(data as WhatsAppSession | null);
        setLoading(false);
      }

      channel = supabase
        .channel(`whatsapp-session-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "whatsapp_sessions",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setSession(payload.new as WhatsAppSession);
          },
        )
        .subscribe();
    }

    void load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  function run(action: () => Promise<{ error?: string; ok?: true }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const status = session?.status ?? "disconnected";

  return (
    <Card className="mx-auto w-full max-w-xl">
      <Card.Header className="flex items-center justify-between gap-3">
        <div>
          <Card.Title>WhatsApp</Card.Title>
          <Card.Description>
            Vincula tu cuenta para sincronizar chats y enviar mensajes.
          </Card.Description>
        </div>
        <Chip color={statusColor[status]} variant="soft">
          {statusLabel[status]}
        </Chip>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {loading ? <Spinner /> : null}

        {status === "qr_ready" && session?.qr_code_base64 ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${session.qr_code_base64}`}
              alt="Código QR de WhatsApp"
              width={280}
              height={280}
              className="rounded-lg bg-white p-3"
            />
            <p className="text-center text-sm text-muted">
              Abre WhatsApp en tu teléfono, entra a Dispositivos vinculados y
              escanea este código.
            </p>
          </div>
        ) : null}

        {status === "connected" ? (
          <p className="text-sm text-muted">
            La sesión está activa. Sincroniza para traer chats individuales y
            grupos. No se descarga el historial de mensajes.
          </p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {status !== "connected" ? (
            <Button
              isDisabled={pending}
              onPress={() => run(connectWhatsApp)}
            >
              {pending ? "Conectando..." : "Vincular WhatsApp"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              isDisabled={pending}
              onPress={() => run(syncChats)}
            >
              Sincronizar chats
            </Button>
          )}
          {status !== "disconnected" ? (
            <Button
              variant="danger-soft"
              isDisabled={pending}
              onPress={() => run(disconnectWhatsApp)}
            >
              Desconectar
            </Button>
          ) : null}
        </div>
      </Card.Content>
    </Card>
  );
}
