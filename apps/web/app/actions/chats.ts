"use server";

import { revalidatePath } from "next/cache";
import { findChats } from "@/lib/chats";
import { createClient } from "@/utils/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function searchChats(query: string) {
  const text = query.trim();
  if (text.length < 2) return [];
  return findChats(text);
}

export async function deleteChat(chatId: string) {
  if (!UUID_PATTERN.test(chatId)) return { error: "Chat no válido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error: cancelError } = await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("chat_id", chatId)
    .eq("status", "pending");
  if (cancelError) return { error: cancelError.message };

  const { data, error } = await supabase
    .from("chats")
    .update({ hidden: true })
    .eq("id", chatId)
    .eq("user_id", user.id)
    .eq("hidden", false)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No se encontró el chat" };

  revalidatePath("/chats");
  revalidatePath("/schedule");
  revalidatePath("/pending");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function dismissUnread(chatId: string) {
  if (!UUID_PATTERN.test(chatId)) return { error: "Chat no válido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: chat, error: readError } = await supabase
    .from("chats")
    .select("last_message_at")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!chat) return { error: "No se encontró el chat" };

  const lastMessageAt = chat.last_message_at
    ? new Date(chat.last_message_at).getTime()
    : 0;
  const dismissedAt = new Date(
    Math.max(Date.now(), Number.isFinite(lastMessageAt) ? lastMessageAt : 0) +
      1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("chats")
    .update({ inbox_dismissed_at: dismissedAt })
    .eq("id", chatId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No se encontró el chat" };

  revalidatePath("/dashboard");
  return { ok: true as const };
}
