require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { SessionManager } = require("./session-manager");
const { requireUser } = require("./auth");
const { startCron } = require("./cron");

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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const authenticate = requireUser(supabase);

app.post("/sessions/connect", authenticate, async (req, res, next) => {
  try {
    const result = await sessions.connect(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/sessions/disconnect", authenticate, async (req, res, next) => {
  try {
    await sessions.disconnect(req.userId);
    res.json({ status: "disconnected" });
  } catch (error) {
    next(error);
  }
});

app.post("/sync-chats", authenticate, async (req, res, next) => {
  try {
    const result = await sessions.syncChats(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Error interno" });
});

app.listen(port, () => {
  console.log(`worker listening on ${port}`);
  startCron(supabase, sessions);
  sessions.restoreSessions().catch((error) => {
    console.error("restore", error);
  });
});
