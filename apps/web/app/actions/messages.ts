"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

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

  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: user.id,
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) {
    return { error: "El mensaje ya no se puede cancelar" };
  }

  revalidatePath("/pending");
  revalidatePath("/history");
  return { ok: true as const };
}
