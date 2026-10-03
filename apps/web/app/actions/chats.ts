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
