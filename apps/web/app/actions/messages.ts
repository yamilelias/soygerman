"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { activeLine } from "@/lib/lines";

export async function scheduleMessage(input: {
  chatId: string;
  messageBody: string;
  scheduledAt: string;
}) {
  const body = input.messageBody.trim();
  if (!input.chatId) return { error: "Elige un chat o grupo" };
  if (!body) return { error: "Escribe el mensaje" };

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return { error: "La fecha y hora deben ser posteriores al momento actual" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  const { data: chat } = await supabase.from("chats").select("id")
    .eq("id", input.chatId).eq("session_id", line.id).eq("hidden", false)
    .maybeSingle();
  if (!chat) return { error: "El chat no pertenece al teléfono activo" };

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
    session_id: line.id,
    chat_id: input.chatId,
    message_body: body,
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath("/pending");
  revalidatePath("/history");
  return { ok: true as const };
}

export async function cancelMessage(id: string) {
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("session_id", line.id)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) {
    return { error: "El mensaje ya no se puede cancelar" };
  }

  revalidatePath("/pending");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function rescheduleMessage(input: {
  id: string;
  scheduledAt: string;
}) {
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return { error: "La fecha y hora deben ser posteriores al momento actual" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };

  const { data: original, error: readError } = await supabase
    .from("scheduled_messages")
    .select("chat_id, message_body, status, session_id")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .eq("session_id", line.id)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!original) return { error: "No se encontró el mensaje" };
  if (original.status !== "sent" && original.status !== "failed") {
    return { error: "Solo se puede reagendar un mensaje enviado o fallido" };
  }
  if (!original.chat_id) {
    return {
      error:
        "El chat ya no existe. Agenda el mensaje de nuevo eligiendo el destino.",
    };
  }

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
    session_id: original.session_id,
    chat_id: original.chat_id,
    message_body: original.message_body,
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath("/pending");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function countFailedMessages() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };

  const { count, error } = await supabase
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .eq("session_id", line.id);
  if (error) return { error: error.message };
  return { count: count ?? 0 };
}
