require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { SessionManager, describeMemory } = require("./session-manager");
const { requireUser } = require("./auth");
const { startCron } = require("./cron");
const { runDigestForUser } = require("./digest");
const { log } = require("./log");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = process.env.WORKER_API_SECRET;

if (!supabaseUrl || !serviceRoleKey || !workerSecret) {
  console.error(
    "Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o WORKER_API_SECRET",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sessions = new SessionManager(supabase);
const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
  }),
);
app.use(express.json());

app.use((req, res, next) => {
  const started = Date.now();
  log("http", `→ ${req.method} ${req.path}`);
  res.on("finish", () => {
    log(
      "http",
      `← ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`,
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const authenticate = requireUser(supabase);
const CHAT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


async function accountFor(req, { createPrimary = false } = {}) {
  const sessionId = req.body?.sessionId;
  if (sessionId != null && (typeof sessionId !== "string" || !CHAT_ID_PATTERN.test(sessionId))) {
    const error = new Error("Línea no válida");
    error.status = 400;
    throw error;
  }
  let query = supabase.from("whatsapp_sessions")
    .select("id, user_id, slot, status")
    .eq("user_id", req.userId);
  query = sessionId ? query.eq("id", sessionId) : query.eq("slot", 1);
  let { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data && createPrimary && !sessionId) {
    const created = await supabase.from("whatsapp_sessions")
      .upsert({ user_id: req.userId, slot: 1, label: "Principal" },
        { onConflict: "user_id,slot", ignoreDuplicates: true })
      .select("id, user_id, slot, status").maybeSingle();
    if (created.error) throw new Error(created.error.message);
    data = created.data;
    if (!data) {
      const found = await supabase.from("whatsapp_sessions")
        .select("id, user_id, slot, status")
        .eq("user_id", req.userId).eq("slot", 1).single();
      if (found.error) throw new Error(found.error.message);
      data = found.data;
    }
  }
  if (!data) {
    const missing = new Error("No se encontró la línea");
    missing.status = 404;
    throw missing;
  }
  sessions.register(data);
  return data;
}

app.post("/sessions/create", authenticate, async (req, res, next) => {
  try {
    if (process.env.MULTI_PHONE_ENABLED !== "true") {
      res.status(403).json({ error: "La segunda línea aún no está habilitada" });
      return;
    }
    const { data, error } = await supabase.from("whatsapp_sessions")
      .insert({ user_id: req.userId, slot: 2, label: "Segundo teléfono" })
      .select("id, user_id, slot, status").single();
    if (error) {
      res.status(error.code === "23505" ? 409 : 500)
        .json({ error: error.code === "23505" ? "Ya existe la segunda línea" : error.message });
      return;
    }
    sessions.register(data);
    res.json({ sessionId: data.id });
  } catch (error) { next(error); }
});

app.post("/sessions/rename", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req);
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (!label || label.length > 40) {
      res.status(400).json({ error: "El nombre debe tener entre 1 y 40 caracteres" });
      return;
    }
    const { error } = await supabase.from("whatsapp_sessions")
      .update({ label }).eq("id", account.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/sessions/connect", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req, { createPrimary: true });
    const result = await sessions.connect(account.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/sessions/disconnect", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req);
    await sessions.disconnect(account.id);
    res.json({ status: "disconnected" });
  } catch (error) {
    next(error);
  }
});

app.post("/digests/run", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req);
    const result = await runDigestForUser(supabase, sessions, req.userId, account.id, {
      force: true,
    });
    if (!result) {
      res.status(409).json({ error: "El resumen de hoy ya se está preparando" });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/refresh-unread", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req);
    const result = await sessions.refreshUnread(account.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/sync-chats", authenticate, async (req, res, next) => {
  try {
    const account = await accountFor(req);
    const result = await sessions.syncChats(account.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

function messageTime(at) {
  if (!at) return null;
  const date = new Date(at > 1e12 ? at : at * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

app.post("/chats/messages", authenticate, async (req, res, next) => {
  try {
    const chatId = req.body?.chatId;
    if (typeof chatId !== "string" || !CHAT_ID_PATTERN.test(chatId)) {
      res.status(400).json({ error: "Chat no válido" });
      return;
    }
    const account = await accountFor(req);
    if (!sessions.isReady(account.id)) {
      res.status(409).json({ error: "WhatsApp no está conectado" });
      return;
    }
    const { data, error } = await supabase
      .from("chats")
      .select(
        "id, wa_id, name, last_message_at, last_message_key, last_message_preview",
      )
      .eq("id", chatId)
      .eq("user_id", req.userId)
      .eq("session_id", account.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      res.status(404).json({ error: "No se encontró el chat" });
      return;
    }
    const messages = (await sessions.recentMessages(account.id, data, 20)).map(
      (item) => ({
        at: messageTime(item.at),
        fromMe: item.fromMe,
        sender: item.sender,
        text: item.text,
      }),
    );
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  log("http", `error ${error.message || error}`);
  res.status(error.status || 500).json({ error: error.message || "Error interno" });
});

app.listen(port, () => {
  log(
    "arranque",
    `puerto ${port} origen ${process.env.WEB_ORIGIN || "http://localhost:3000"} ${describeMemory()}`,
  );
  startCron(supabase, sessions);
  setInterval(() => {
    log("capacidad", `sesiones=${sessions.clients.size} ${describeMemory()}`);
  }, 60_000).unref();
  sessions.restoreSessions().catch((error) => {
    log("restore", error.message || String(error));
  });
});
