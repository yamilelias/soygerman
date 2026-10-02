import type { Chat } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const CHAT_PAGE_SIZE = 40;
const SEARCH_LIMIT = 20;

const COLUMNS = "id, user_id, wa_id, name, is_group, updated_at";

export type ChatKind = "all" | "groups" | "direct";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ilike(column: string, raw: string) {
  const escaped = raw
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const pattern = `%${escaped}%`.replaceAll('"', '""');
  return `${column}.ilike."${pattern}"`;
}

function waIdHas(digits: string, host: string) {
  const pattern = `%${digits}%@${host}`.replaceAll('"', '""');
  return `wa_id.ilike."${pattern}"`;
}

function matchFilter(term: string) {
  const text = term.trim();
  if (!text) return null;
  const parts = [ilike("name", text)];
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 3) {
    parts.push(waIdHas(digits, "s.whatsapp.net"));
    parts.push(waIdHas(digits, "c.us"));
  }
  return parts.join(",");
}

export async function searchChats({
  query = "",
  kind = "all",
  page = 1,
  pageSize = CHAT_PAGE_SIZE,
}: {
  query?: string;
  kind?: ChatKind;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ chats: Chat[]; total: number }> {
  const supabase = await createClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Math.min(Math.max(Math.floor(pageSize), 1), CHAT_PAGE_SIZE);
  const from = (safePage - 1) * size;
  const match = matchFilter(query);

  let listed = supabase.from("chats").select(COLUMNS);
  let counted = supabase.from("chats").select("id", { count: "exact", head: true });
  if (kind === "groups") {
    listed = listed.eq("is_group", true);
    counted = counted.eq("is_group", true);
  } else if (kind === "direct") {
    listed = listed.eq("is_group", false);
    counted = counted.eq("is_group", false);
  }
  if (match) {
    listed = listed.or(match);
    counted = counted.or(match);
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    listed.order("name").order("id").range(from, from + size - 1),
    counted,
  ]);

  if (error) throw new Error(error.message);
  if (countError) throw new Error(countError.message);

  return {
    chats: (data ?? []) as Chat[],
    total: count ?? 0,
  };
}

export async function findChats(query: string): Promise<Chat[]> {
  const { chats } = await searchChats({
    query,
    pageSize: SEARCH_LIMIT,
  });
  return chats;
}

export async function getChat(id: string): Promise<Chat | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chats")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Chat | null) ?? null;
}
