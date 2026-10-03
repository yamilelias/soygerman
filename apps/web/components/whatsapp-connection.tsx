"use client";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useRouter } from "next/navigation";
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
  interrupted: "Interrumpida",
};

const statusColor = {
  disconnected: "default",
  connecting: "warning",
  qr_ready: "warning",
  authenticating: "warning",
  connected: "success",
  interrupted: "danger",
} as const;

const PAIRING_STATUSES: WhatsAppSessionStatus[] = [
  "connecting",
  "qr_ready",
  "authenticating",
];

async function pullChats() {
  let lastError = "No se pudieron traer los chats";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await syncChats();
    if (!result.error) return { ok: true as const };
    lastError = result.error;
    if (!result.error.includes("No se pudo leer")) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { error: lastError };
}

export function WhatsAppConnection() {
  const router = useRouter();
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sawProgress = useRef(false);
  const ignoreDisconnect = useRef(false);
  const resumed = useRef(false);
  const previousStatus = useRef<WhatsAppSessionStatus | null>(null);
  const syncedStamp = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function readSession(userId: string) {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("id, user_id, status, qr_code_base64, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      setSession(data as WhatsAppSession | null);
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
    const previous = previousStatus.current;
    previousStatus.current = session.status;

    if (session.status === "interrupted") {
      sawProgress.current = false;
      ignoreDisconnect.current = false;
      setLinking(false);
      if (previous !== "interrupted") setError(null);
      return;
    }
    if (PAIRING_STATUSES.includes(session.status)) {
      if (ignoreDisconnect.current) return;
      sawProgress.current = true;
      if (
        previous === "connected" ||
        previous === "interrupted"
      ) {
        setError(null);
      }
      return;
    }
    if (session.status === "connected") {
      sawProgress.current = false;
      ignoreDisconnect.current = false;
      setLinking(false);
      if (previous && previous !== "connected") {
        setError(null);
        if (syncedStamp.current !== session.updated_at) {
          syncedStamp.current = session.updated_at;
          startTransition(async () => {
            const result = await pullChats();
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }
      }
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
  }, [router, session]);

  useEffect(() => {
    if (loading || resumed.current || !session) return;
    if (!PAIRING_STATUSES.includes(session.status)) return;
    resumed.current = true;
    setLinking(true);
    startTransition(async () => {
      const result = await connectWhatsApp();
      if (result.error) {
        resumed.current = false;
        setLinking(false);
        setError(result.error);
      }
    });
  }, [loading, session]);

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
            Conexión exitosa. Los chats llegan solos. No se descarga el
            historial de mensajes.
          </p>
        ) : null}

        {status === "interrupted" ? (
          <p className="text-sm text-danger">
            La conexión se interrumpió. WhatsApp ya no está listo. Vuelve a
            vincular para continuar.
          </p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {status !== "connected" ? (
            <Button isDisabled={pending || linking} onPress={startConnect}>
              {linking ? "Vinculando..." : "Vincular WhatsApp"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              isDisabled={pending}
              onPress={() => run(syncChats)}
            >
              Volver a sincronizar
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
