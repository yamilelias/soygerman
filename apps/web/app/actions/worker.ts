"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

async function callWorker(path: string) {
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
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      console.error(
        `[worker] POST ${url} ${response.status} ${body.error || "sin detalle"}`,
      );
      return { error: body.error || "Error del worker" };
    }
    console.info(`[worker] POST ${url} ${response.status}`);
    return { ok: true as const };
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
  return callWorker("/sessions/disconnect");
}

export async function syncChats() {
  const result = await callWorker("/sync-chats");
  if ("ok" in result) revalidatePath("/chats");
  return result;
}
