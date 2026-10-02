"use server";

import { findChats } from "@/lib/chats";

export async function searchChats(query: string) {
  const text = query.trim();
  if (text.length < 2) return [];
  return findChats(text);
}
