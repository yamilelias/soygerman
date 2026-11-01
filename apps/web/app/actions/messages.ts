"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { activeLine } from "@/lib/lines";

type MessageInput = {
  chatId: string;
  messageBody: string;
  scheduledAt: string;
};

function validateMessage(input: MessageInput) {
  const body = input.messageBody.trim();
  if (!input.chatId) return { error: "Elige un chat o grupo" };
  if (!body) return { error: "Escribe el mensaje" };
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return { error: "La fecha y hora deben ser posteriores al momento actual" };
  }
  return { body, scheduledAt };
}

async function validateChat(chatId: string, lineId: string) {
  const supabase = await createClient();
  const { data: chat } = await supabase.from("chats").select("id")
    .eq("id", chatId).eq("session_id", lineId).eq("hidden", false)
    .maybeSingle();
  return Boolean(chat);
}

export async function scheduleMessage(input: MessageInput) {
  const validated = validateMessage(input);
  if (validated.error) return { error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  if (!await validateChat(input.chatId, line.id)) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
    session_id: line.id,
    chat_id: input.chatId,
    message_body: validated.body,
    scheduled_at: validated.scheduledAt!.toISOString(),
    status: "pending",
  });

  if (error) return { error: error.message };

  revalidatePath("/pending");
  revalidatePath("/history");
  return { ok: true as const };
}

export async function editMessage(input: MessageInput & { id: string }) {
  const validated = validateMessage(input);
  if (validated.error) return { error: validated.error };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };
  if (!await validateChat(input.chatId, line.id)) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const { data, error } = await supabase.from("scheduled_messages")
    .update({
      chat_id: input.chatId,
      message_body: validated.body,
      scheduled_at: validated.scheduledAt!.toISOString(),
    })
    .eq("id", input.id).eq("user_id", user.id)
    .eq("session_id", line.id).eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "El mensaje ya no está pendiente; vuelve a cargar la página" };

  revalidatePath("/pending");
  revalidatePath("/dashboard");
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

export async function rescheduleMessage(input: MessageInput & { id: string }) {
  const validated = validateMessage(input);
  if (validated.error) return { error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };

  const { data: original, error: readError } = await supabase
    .from("scheduled_messages")
    .select("status, session_id")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .eq("session_id", line.id)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!original) return { error: "No se encontró el mensaje" };
  if (original.status !== "sent" && original.status !== "failed") {
    return { error: "Solo se puede reagendar un mensaje enviado o fallido" };
  }
  if (!await validateChat(input.chatId, line.id)) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
    session_id: original.session_id,
    chat_id: input.chatId,
    message_body: validated.body,
    scheduled_at: validated.scheduledAt!.toISOString(),
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
