"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LINE_COOKIE, listLines } from "@/lib/lines";

export async function selectLine(sessionId: string) {
  const lines = await listLines();
  if (!lines.some((line) => line.id === sessionId)) {
    return { error: "No se encontró la línea" };
  }
  (await cookies()).set(LINE_COOKIE, sessionId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  for (const path of ["/dashboard", "/chats", "/schedule", "/pending", "/history"]) {
    revalidatePath(path);
  }
  return { ok: true as const };
}
