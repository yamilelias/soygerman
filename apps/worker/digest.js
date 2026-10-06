const { log } = require("./log");
const { completeDigest, digestModelName } = require("./llm");

const BATCH_SIZE = 40;
const MAX_CHATS = 200;
const CONTEXT_COUNT = 5;
const STALE_RUNNING_MS = 15 * 60 * 1000;
const TIME_ZONE = "America/Mexico_City";
const MISSING_CONTEXT = "No hubo más mensajes para ampliar el contexto.";

const CHAT_COLUMNS =
  "id, wa_id, name, is_group, last_message_preview, last_message_from_me, last_message_at, last_message_key, unread_count, marked_unread, hidden, archived";

const inflight = new Set();

function mexicoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isOpenUnread(chat) {
  if (!chat || chat.hidden || chat.archived) return false;
  if (chat.inbox_visible === false) return false;
  return (chat.unread_count || 0) > 0 || chat.marked_unread === true;
}

function batches(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function truncate(message) {
  const text = message || "Error desconocido";
  return text.length > 500 ? text.slice(0, 500) : text;
}

function promptForChats(chats, date) {
  const lines = chats
    .map((chat) => {
      const who = chat.last_message_from_me ? "tú" : "la otra persona";
      const text = chat.last_message_preview || "(sin texto)";
      return [
        `- wa_id: ${chat.wa_id}`,
        `  nombre: ${chat.name}`,
        `  grupo: ${chat.is_group ? "sí" : "no"}`,
        `  último mensaje (${who}): ${text}`,
      ].join("\n");
    })
    .join("\n");

  return `Fecha en Ciudad de México: ${date}.
Eres el asistente personal de WhatsApp de quien lee estos chats.
Resume las actividades pendientes: responder, confirmar o hacer algo concreto.
No inventes una tarea si el mensaje es un saludo, un agradecimiento, un sticker o un cierre.
Si el último mensaje no dice qué hay que hacer, pon needs_more_context en true y action vacío.
Si no hay nada pendiente y el mensaje se entiende, no incluyas ese chat.
Devuelve un overview en español, en un párrafo, y un ítem por cada chat que sí entra.

${lines}`;
}

function promptForContext({ date, overview, settled, pending }) {
  const done = settled
    .map((item) => `- ${item.name}: ${item.action}`)
    .join("\n");
  const extra = pending
    .map((entry) => {
      const lines = entry.messages.map((text, index) => `  ${index + 1}. ${text}`);
      const lastWho = entry.chat.last_message_from_me ? "tú" : "la otra persona";
      const last = entry.chat.last_message_preview || "(sin texto)";
      return [
        `- wa_id: ${entry.chat.wa_id}`,
        `  nombre: ${entry.chat.name}`,
        `  mensajes anteriores:`,
        ...lines,
        `  último mensaje (${lastWho}): ${last}`,
      ].join("\n");
    })
    .join("\n");

  return `Fecha en Ciudad de México: ${date}.
Reescribe el resumen del día con el contexto que faltaba.
Overview previo: ${overview || "(vacío)"}
Acciones que ya estaban claras:
${done || "(ninguna)"}

Estos chats necesitan el contexto de los mensajes anteriores. Si ahora se entiende la tarea, devuelve action y needs_more_context en false. Si sigue sin haber tarea, no incluyas ese chat.

${extra}`;
}

function normalize(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    overview: typeof raw?.overview === "string" ? raw.overview.trim() : "",
    items: items
      .filter((item) => item && typeof item.wa_id === "string")
      .map((item) => ({
        wa_id: item.wa_id,
        action: typeof item.action === "string" ? item.action.trim() : "",
        needs_more_context: Boolean(item.needs_more_context),
      })),
  };
}

function notedAction(chat, draft) {
  const base = draft?.trim() || chat.last_message_preview || "Revisar la conversación";
  return `${base} ${MISSING_CONTEXT}`;
}

function storeItem(chat, action) {
  return { chat_id: chat.id, name: chat.name, action };
}

async function composeDigest(chats, { date, complete, fetchContext, omitted = 0 }) {
  const settled = [];
  const pending = [];
  const overviews = [];

  for (const chunk of batches(chats, BATCH_SIZE)) {
    const parsed = normalize(await complete(promptForChats(chunk, date)));
    if (parsed.overview) overviews.push(parsed.overview);
    for (const item of parsed.items) {
      const chat = chunk.find((candidate) => candidate.wa_id === item.wa_id);
      if (!chat) continue;
      if (item.needs_more_context) pending.push({ chat, draft: item.action });
      else if (item.action) settled.push(storeItem(chat, item.action));
    }
  }

  let overview = overviews.join(" ");
  const readyForContext = [];

  for (const entry of pending) {
    let messages = [];
    try {
      messages = await fetchContext(entry.chat);
    } catch (error) {
      log("resumen", `contexto ${entry.chat.wa_id}: ${error.message || error}`);
      messages = [];
    }
    if (!Array.isArray(messages) || messages.length < CONTEXT_COUNT) {
      settled.push(storeItem(entry.chat, notedAction(entry.chat, entry.draft)));
      continue;
    }
    readyForContext.push({
      ...entry,
      messages: messages.slice(0, CONTEXT_COUNT),
    });
  }

  if (readyForContext.length > 0) {
    const rewritten = [];
    for (const chunk of batches(readyForContext, BATCH_SIZE)) {
      const parsed = normalize(
        await complete(
          promptForContext({ date, overview, settled, pending: chunk }),
        ),
      );
      if (parsed.overview) rewritten.push(parsed.overview);
      const seen = new Set();
      for (const item of parsed.items) {
        const entry = chunk.find((candidate) => candidate.chat.wa_id === item.wa_id);
        if (!entry) continue;
        seen.add(item.wa_id);
        if (item.needs_more_context) {
          settled.push(storeItem(entry.chat, notedAction(entry.chat, item.action || entry.draft)));
        } else if (item.action) {
          settled.push(storeItem(entry.chat, item.action));
        }
      }
      for (const entry of chunk) {
        if (seen.has(entry.chat.wa_id)) continue;
        settled.push(storeItem(entry.chat, notedAction(entry.chat, entry.draft)));
      }
    }
    if (rewritten.length > 0) overview = rewritten.join(" ");
  }

  if (omitted > 0) {
    const extra = `Quedaron ${omitted} conversaciones sin leer fuera de este resumen.`;
    overview = overview ? `${overview} ${extra}` : extra;
  }

  const byChat = new Map();
  for (const item of settled) byChat.set(item.chat_id, item);
  return { overview: overview.trim(), items: [...byChat.values()] };
}

function isFreshRunning(row, now) {
  if (!row || row.status !== "running" || !row.updated_at) return false;
  const updated = new Date(row.updated_at).getTime();
  return Number.isFinite(updated) && now.getTime() - updated < STALE_RUNNING_MS;
}

async function readDigest(supabase, userId, digestDate) {
  const { data, error } = await supabase
    .from("daily_digests")
    .select(
      "id, user_id, digest_date, status, overview, items, error_message, model, updated_at",
    )
    .eq("user_id", userId)
    .eq("digest_date", digestDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function writeDigest(supabase, row) {
  const { data, error } = await supabase
    .from("daily_digests")
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "user_id,digest_date" },
    )
    .select(
      "id, user_id, digest_date, status, overview, items, error_message, model, updated_at",
    )
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadUnread(supabase, userId) {
  const { data, error, count } = await supabase
    .from("chats")
    .select(CHAT_COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .eq("inbox_visible", true)
    .order("unread_since", { ascending: true, nullsFirst: false })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CHATS);
  if (error) throw new Error(error.message);
  const rows = (data || []).filter(isOpenUnread);
  return { rows, count: count ?? rows.length };
}

async function runDigestForUser(supabase, sessions, userId, options = {}) {
  if (inflight.has(userId)) return null;
  inflight.add(userId);
  const now = options.now || new Date();
  const force = options.force === true;
  const complete = options.complete || completeDigest;
  const fetchContext =
    options.fetchContext ||
    ((chat) => sessions.recentTexts(userId, chat));
  const digestDate = mexicoDate(now);
  const model = digestModelName();

  try {
    const existing = await readDigest(supabase, userId, digestDate);
    if (
      !force &&
      existing &&
      (existing.status === "ready" || existing.status === "empty")
    ) {
      return existing;
    }
    if (!force && isFreshRunning(existing, now)) return existing;

    await writeDigest(supabase, {
      user_id: userId,
      digest_date: digestDate,
      status: "running",
      overview: null,
      items: [],
      error_message: null,
      model,
    });

    const fail = (message) =>
      writeDigest(supabase, {
        user_id: userId,
        digest_date: digestDate,
        status: "failed",
        overview: null,
        items: [],
        error_message: truncate(message),
        model,
      });

    try {
      if (!sessions.isReady(userId)) {
        return await fail("WhatsApp no está conectado para este usuario");
      }
      const { rows, count } = await loadUnread(supabase, userId);
      if (rows.length === 0) {
        return await writeDigest(supabase, {
          user_id: userId,
          digest_date: digestDate,
          status: "empty",
          overview: null,
          items: [],
          error_message: null,
          model,
        });
      }
      const composed = await composeDigest(rows, {
        date: digestDate,
        complete,
        fetchContext,
        omitted: Math.max(0, count - rows.length),
      });
      return await writeDigest(supabase, {
        user_id: userId,
        digest_date: digestDate,
        status: "ready",
        overview: composed.overview,
        items: composed.items,
        error_message: null,
        model,
      });
    } catch (error) {
      log("resumen", `${userId} ${error.message || error}`);
      return await fail(error.message || String(error));
    }
  } finally {
    inflight.delete(userId);
  }
}

async function runDailyDigests(supabase, sessions, now = new Date()) {
  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .select("user_id")
    .eq("status", "connected");
  if (error) {
    log("resumen", error.message);
    return;
  }
  for (const row of data || []) {
    try {
      await runDigestForUser(supabase, sessions, row.user_id, { now });
    } catch (digestError) {
      log("resumen", `${row.user_id} ${digestError.message || digestError}`);
    }
  }
}

module.exports = {
  BATCH_SIZE,
  CONTEXT_COUNT,
  MAX_CHATS,
  MISSING_CONTEXT,
  batches,
  composeDigest,
  isOpenUnread,
  mexicoDate,
  promptForChats,
  promptForContext,
  runDailyDigests,
  runDigestForUser,
};
