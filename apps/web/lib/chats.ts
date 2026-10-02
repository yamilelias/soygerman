import type { Chat } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

export async function listChats(): Promise<Chat[]> {
  const supabase = await createClient();
  const rows: Chat[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("chats")
      .select("id, user_id, wa_id, name, is_group, updated_at")
      .order("name")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as Chat[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }

  throw new Error("La lista de chats supera el máximo que se puede leer");
}

export function byDestination(a: Chat, b: Chat) {
  if (a.is_group !== b.is_group) return a.is_group ? -1 : 1;
  const byName = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}
