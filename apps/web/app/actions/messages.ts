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
  const { data: chat } = await supabase.from("chats").select("id, wa_id, name")
    .eq("id", chatId).eq("session_id", lineId).eq("hidden", false)
    .maybeSingle();
  return chat;
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
  const chat = await validateChat(input.chatId, line.id);
  if (!chat) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
    session_id: line.id,
    chat_id: input.chatId,
    destination_wa_id: chat.wa_id,
    destination_name: chat.name,
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
  const chat = await validateChat(input.chatId, line.id);
  if (!chat) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const { data, error } = await supabase.from("scheduled_messages")
    .update({
      chat_id: input.chatId,
      destination_wa_id: chat.wa_id,
      destination_name: chat.name,
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
    .select("status, session_id, scheduled_at")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .eq("session_id", line.id)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!original) return { error: "No se encontró el mensaje" };
  if (original.status !== "sent" && original.status !== "failed" && original.status !== "cancelled") {
    return { error: "Solo se puede reagendar un mensaje enviado, fallido o cancelado" };
  }
  const chat = await validateChat(input.chatId, line.id);
  if (!chat) {
    return { error: "El chat no pertenece al teléfono activo" };
  }

  const sourceId = original.status !== "sent" && new Date(original.scheduled_at).getTime() > Date.now()
    ? input.id : null;
  const { error, count } = await supabase.from("scheduled_messages").upsert({
    user_id: user.id,
    session_id: original.session_id,
    chat_id: input.chatId,
    destination_wa_id: chat.wa_id,
    destination_name: chat.name,
    message_body: validated.body,
    scheduled_at: validated.scheduledAt!.toISOString(),
    status: "pending",
    rescheduled_from_id: sourceId,
  }, { onConflict: "user_id,rescheduled_from_id", ignoreDuplicates: true, count: "exact" });

  if (error) return { error: error.message };
  if (sourceId && count === 0) return { error: "Este mensaje ya está reagendado" };

  revalidatePath("/pending");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function rescheduleFutureMessages(selections: { id: string; chatId?: string }[]) {
  const uniqueIds = [...new Set(selections.map((selection) => selection.id))];
  if (!uniqueIds.length) return { error: "Selecciona al menos un mensaje" };
  if (uniqueIds.length !== selections.length) return { error: "Hay mensajes repetidos en la selección" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
  const line = await activeLine();
  if (!line) return { error: "No hay teléfono activo" };

  const { data: originals, error: readError } = await supabase
    .from("scheduled_messages")
    .select("id, chat_id, message_body, scheduled_at, status, destination_wa_id")
    .in("id", uniqueIds).eq("user_id", user.id).eq("session_id", line.id);
  if (readError) return { error: readError.message };
  const currentTime = Date.now();
  if (originals?.length !== uniqueIds.length || originals.some((message) =>
    (message.status !== "failed" && message.status !== "cancelled") ||
    new Date(message.scheduled_at).getTime() <= currentTime
  )) return { error: "Uno de los mensajes ya no se puede reagendar. Actualiza el historial." };

  const waIds = [...new Set(originals.map((message) => message.destination_wa_id).filter((id): id is string => Boolean(id)))];
  const { data: chats, error: chatError } = waIds.length
    ? await supabase.from("chats").select("id, wa_id, name")
      .eq("session_id", line.id).eq("hidden", false).in("wa_id", waIds)
    : { data: [], error: null };
  if (chatError) return { error: chatError.message };
  const legacyIds = originals.filter((message) => !message.destination_wa_id && message.chat_id)
    .map((message) => message.chat_id as string);
  const { data: legacyChats, error: legacyError } = legacyIds.length
    ? await supabase.from("chats").select("id, wa_id, name")
      .eq("session_id", line.id).eq("hidden", false).in("id", legacyIds)
    : { data: [], error: null };
  if (legacyError) return { error: legacyError.message };
  const byWaId = new Map((chats ?? []).map((chat) => [chat.wa_id, chat]));
  const byId = new Map((legacyChats ?? []).map((chat) => [chat.id, chat]));
  const chosenIds = [...new Set(selections.map((selection) => selection.chatId).filter((id): id is string => Boolean(id)))];
  const { data: chosenChats, error: chosenError } = chosenIds.length
    ? await supabase.from("chats").select("id, wa_id, name")
      .eq("session_id", line.id).eq("hidden", false).in("id", chosenIds)
    : { data: [], error: null };
  if (chosenError) return { error: chosenError.message };
  if (chosenChats?.length !== chosenIds.length) return { error: "Una conversación elegida ya no está disponible" };
  const chosenById = new Map((chosenChats ?? []).map((chat) => [chat.id, chat]));
  const selectionsById = new Map(selections.map((selection) => [selection.id, selection]));
  const rows = originals.map((message) => {
    const chosenId = selectionsById.get(message.id)?.chatId;
    const chat = chosenId ? chosenById.get(chosenId) :
      message.destination_wa_id ? byWaId.get(message.destination_wa_id) :
        message.chat_id ? byId.get(message.chat_id) : null;
    return chat ? {
      user_id: user.id,
      session_id: line.id,
      chat_id: chat.id,
      destination_wa_id: chat.wa_id,
      destination_name: chat.name,
      message_body: message.message_body,
      scheduled_at: message.scheduled_at,
      status: "pending",
      rescheduled_from_id: message.id,
    } : null;
  });
  if (rows.some((row) => !row)) return { error: "Una conversación ya no está disponible. Reagéndala individualmente y elige un destino." };

  const { error, count } = await supabase.from("scheduled_messages")
    .upsert(rows.filter((row) => row !== null), {
      onConflict: "user_id,rescheduled_from_id",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) return { error: error.message };
  revalidatePath("/pending");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { count: count ?? 0 };
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
