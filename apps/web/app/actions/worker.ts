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
  if (!base || !secret) return { error: "El worker no está configurado" };

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
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
      return { error: body.error || "Error del worker" };
    }
    return { ok: true as const };
  } catch {
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
