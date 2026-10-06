"use server";

import { revalidatePath } from "next/cache";
import type { ChatPreviewMessage } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

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

export async function connectWhatsApp() {
  return callWorker("/sessions/connect");
}

export async function disconnectWhatsApp() {
  const result = await callWorker("/sessions/disconnect");
  if ("ok" in result) {
    revalidatePath("/chats");
    revalidatePath("/schedule");
    revalidatePath("/pending");
    revalidatePath("/history");
  }
  return result;
}

export async function syncChats() {
  const result = await callWorker("/sync-chats");
  if ("ok" in result) revalidatePath("/chats");
  return result;
}

export async function refreshUnread() {
  const result = await callWorker("/refresh-unread", 45000);
  if ("ok" in result) revalidatePath("/dashboard");
  return result;
}

export async function loadChatPreview(chatId: string) {
  if (!UUID_PATTERN.test(chatId)) return { error: "Chat no válido" };
  const result = await callWorker<{ messages?: ChatPreviewMessage[] }>(
    "/chats/messages",
    20000,
    { chatId },
  );
  if (!("ok" in result)) {
    return { error: result.error ?? "Error del worker" };
  }
  return {
    messages: Array.isArray(result.messages) ? result.messages : [],
  };
}
