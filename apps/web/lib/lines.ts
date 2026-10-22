import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { WhatsAppSession } from "@/lib/types";

export const LINE_COOKIE = "soygerman-line";

export async function listLines(): Promise<WhatsAppSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_sessions")
    .select("id, user_id, slot, label, phone_number, error_message, status, updated_at")
    .order("slot");
  if (error) throw new Error(error.message);
  return (data ?? []).map((line) => ({ ...line, qr_code_base64: null })) as WhatsAppSession[];
}

export async function activeLine(): Promise<WhatsAppSession | null> {
  const lines = await listLines();
  const chosen = (await cookies()).get(LINE_COOKIE)?.value;
  return lines.find((line) => line.id === chosen) ?? lines[0] ?? null;
}
