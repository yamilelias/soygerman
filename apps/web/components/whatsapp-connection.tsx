"use client";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  syncChats,
} from "@/app/actions/worker";
import type { WhatsAppSession, WhatsAppSessionStatus } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";

const QR_BOX = 280;

const statusLabel: Record<WhatsAppSessionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Preparando",
  qr_ready: "Esperando escaneo",
  authenticating: "Conectando",
  connected: "Conectado",
};

const statusColor = {
  disconnected: "default",
  connecting: "warning",
  qr_ready: "warning",
  authenticating: "warning",
  connected: "success",
} as const;

const PAIRING_STATUSES: WhatsAppSessionStatus[] = [
  "connecting",
  "qr_ready",
  "authenticating",
];

export function WhatsAppConnection() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sawProgress = useRef(false);
  const ignoreDisconnect = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function readSession(userId: string) {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("id, user_id, status, qr_code_base64, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (active) setSession(data as WhatsAppSession | null);
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) {
        setLoading(false);
        return;
      }

      await readSession(user.id);
      if (active) setLoading(false);

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
            if (payload.new && "status" in payload.new) {
              setSession(payload.new as WhatsAppSession);
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void readSession(user.id);
        });
    }

    void load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (PAIRING_STATUSES.includes(session.status)) {
      if (ignoreDisconnect.current) return;
      sawProgress.current = true;
      setLinking(true);
      return;
    }
    if (session.status === "connected") {
      sawProgress.current = false;
      ignoreDisconnect.current = false;
      setLinking(false);
      return;
    }
    if (session.status === "disconnected" && sawProgress.current) {
      sawProgress.current = false;
      setLinking(false);
      if (!ignoreDisconnect.current) {
        setError("No se pudo vincular WhatsApp. Puedes intentarlo otra vez.");
      }
      ignoreDisconnect.current = false;
    }
  }, [session]);

  function run(action: () => Promise<{ error?: string; ok?: true }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function startConnect() {
    setError(null);
    sawProgress.current = false;
    ignoreDisconnect.current = false;
    setLinking(true);
    startTransition(async () => {
      const result = await connectWhatsApp();
      if (result.error) {
        setLinking(false);
        setError(result.error);
      }
    });
  }

  function startDisconnect() {
    ignoreDisconnect.current = true;
    sawProgress.current = false;
    setLinking(false);
    setError(null);
    run(disconnectWhatsApp);
  }

  const storedStatus = session?.status ?? "disconnected";
  const status: WhatsAppSessionStatus =
    linking && storedStatus === "disconnected" ? "connecting" : storedStatus;
  const showPairing =
    storedStatus !== "connected" &&
    (linking || PAIRING_STATUSES.includes(storedStatus));
  const qr = session?.qr_code_base64 ?? null;
  const showQr = Boolean(qr) && (status === "qr_ready" || status === "authenticating");

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

        {!loading && showPairing ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative flex items-center justify-center rounded-lg bg-white p-3"
              style={{ width: QR_BOX + 24, height: QR_BOX + 24 }}
            >
              {showQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${qr}`}
                  alt="Código QR de WhatsApp"
                  width={QR_BOX}
                  height={QR_BOX}
                  style={{ width: QR_BOX, height: QR_BOX }}
                />
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ width: QR_BOX, height: QR_BOX }}
                >
                  <Spinner />
                </div>
              )}
              {status === "authenticating" && showQr ? (
                <div className="absolute inset-3 flex items-center justify-center rounded-md bg-white/80">
                  <Spinner />
                </div>
              ) : null}
            </div>
            <p className="text-center text-sm text-muted">
              {status === "authenticating"
                ? showQr
                  ? "Detectamos el escaneo. Terminando la vinculación."
                  : "Terminando la vinculación."
                : showQr
                  ? "Abre WhatsApp en tu teléfono, entra a Dispositivos vinculados y escanea este código."
                  : "Estamos generando el código. No hace falta volver a pulsar el botón."}
            </p>
          </div>
        ) : null}

        {status === "connected" ? (
          <p className="text-sm text-muted">
            Conexión exitosa. La sesión está activa. Sincroniza para traer
            chats individuales y grupos. No se descarga el historial de
            mensajes.
          </p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {status !== "connected" ? (
            <Button
              isDisabled={pending || showPairing}
              onPress={startConnect}
            >
              {showPairing ? "Vinculando..." : "Vincular WhatsApp"}
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
          {status !== "disconnected" || showPairing ? (
            <Button
              variant="danger-soft"
              isDisabled={pending}
              onPress={startDisconnect}
            >
              Desconectar
            </Button>
          ) : null}
        </div>
      </Card.Content>
    </Card>
  );
}
