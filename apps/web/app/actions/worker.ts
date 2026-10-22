"use server";

import { revalidatePath } from "next/cache";
import type { ChatPreviewMessage } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { activeLine } from "@/lib/lines";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callWorker<T extends Record<string, unknown> = Record<string, never>>(
  path: string,
  timeoutMs?: number,
  payload?: unknown,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "No autenticado" };

  const base = process.env.WORKER_URL;
  const secret = process.env.WORKER_API_SECRET;
  if (!base || !secret) {
    console.error(`[worker] ${path} sin WORKER_URL o WORKER_API_SECRET`);
    return { error: "El worker no está configurado" };
  }

  const url = `${base.replace(/\/$/, "")}${path}`;
  console.info(`[worker] POST ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": secret,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: "no-store",
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: string;
    };
    if (!response.ok) {
      console.error(
        `[worker] POST ${url} ${response.status} ${body.error || "sin detalle"}`,
      );
      return { error: body.error || "Error del worker" };
    }
    console.info(`[worker] POST ${url} ${response.status}`);
    return { ok: true as const, ...body };
  } catch (error) {
    const message = error instanceof Error ? error.message : "error de red";
    console.error(`[worker] POST ${url} no respondió: ${message}`);
    return { error: "No se pudo contactar al worker" };
  }
}

export async function connectWhatsApp(sessionId?: string) {
  return callWorker("/sessions/connect", undefined,
    sessionId ? { sessionId } : undefined);
}

export async function disconnectWhatsApp(sessionId: string) {
  const result = await callWorker("/sessions/disconnect", undefined, { sessionId });
  if ("ok" in result) {
    revalidatePath("/chats");
    revalidatePath("/schedule");
    revalidatePath("/pending");
    revalidatePath("/history");
  }
  return result;
}

export async function syncChats(sessionId: string) {
  const result = await callWorker("/sync-chats", undefined, { sessionId });
  if ("ok" in result) revalidatePath("/chats");
  return result;
}

export async function refreshUnread() {
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  const result = await callWorker("/refresh-unread", 45000, { sessionId: line.id });
  if ("ok" in result) revalidatePath("/dashboard");
  return result;
}

export async function loadChatPreview(chatId: string) {
  if (!UUID_PATTERN.test(chatId)) return { error: "Chat no válido" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  const result = await callWorker<{ messages?: ChatPreviewMessage[] }>(
    "/chats/messages",
    20000,
    { chatId, sessionId: line.id },
  );
  if (!("ok" in result)) {
    return { error: result.error ?? "Error del worker" };
  }
  return {
    messages: Array.isArray(result.messages) ? result.messages : [],
  };
}

export async function createWhatsAppLine() {
  if (process.env.MULTI_PHONE_ENABLED !== "true") {
    return { error: "La segunda línea aún no está habilitada" };
  }
  const result = await callWorker<{ sessionId?: string }>("/sessions/create");
  if ("ok" in result) revalidatePath("/settings");
  return result;
}

export async function renameWhatsAppLine(sessionId: string, label: string) {
  if (!UUID_PATTERN.test(sessionId)) return { error: "Línea no válida" };
  const result = await callWorker("/sessions/rename", undefined, { sessionId, label });
  if ("ok" in result) revalidatePath("/settings");
  return result;
}
