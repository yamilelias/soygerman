import type { Chat } from "@/lib/types";

const PHONE_JID = /^(\d{8,15})@(s\.whatsapp\.net|c\.us)$/;

export function phoneFromWaId(waId: string) {
  const match = PHONE_JID.exec(waId);
  return match ? match[1] : null;
}

export function formatPhone(waId: string) {
  const digits = phoneFromWaId(waId);
  return digits ? `+${digits}` : null;
}

export function chatLabel(chat: Pick<Chat, "name" | "wa_id" | "is_group">) {
  const phone = formatPhone(chat.wa_id);
  if (phone) return `${chat.name} · ${phone}`;
  return `${chat.name} · ${chat.is_group ? "Grupo" : "Directo"}`;
}
