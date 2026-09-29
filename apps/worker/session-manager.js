const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dataPath() {
  return process.env.WWEBJS_DATA_PATH || path.join(__dirname, ".wwebjs_auth");
}

function classifyChat(waId, isGroup) {
  if (!waId || waId === "status@broadcast" || waId.endsWith("@broadcast")) {
    return null;
  }
  if (waId.endsWith("@newsletter")) return null;
  if (isGroup || waId.endsWith("@g.us")) return true;
  if (
    waId.endsWith("@c.us") ||
    waId.endsWith("@s.whatsapp.net") ||
    waId.endsWith("@lid")
  ) {
    return false;
  }
  return null;
}

class SessionManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.clients = new Map();
  }

  getClient(userId) {
    return this.clients.get(userId)?.client ?? null;
  }

  isReady(userId) {
    return this.clients.get(userId)?.status === "ready";
  }

  async upsertSession(userId, fields) {
    const { error } = await this.supabase.from("whatsapp_sessions").upsert(
      {
        user_id: userId,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("whatsapp_sessions", userId, error.message);
    }
  }

  async destroyClient(userId) {
    const entry = this.clients.get(userId);
    if (!entry) return;
    this.clients.delete(userId);
    try {
      await entry.client.destroy();
    } catch (error) {
      console.error("destroy", userId, error);
    }
  }

  async connect(userId) {
    const existing = this.clients.get(userId);
    if (
      existing &&
      (existing.status === "ready" || existing.status === "initializing")
    ) {
      return { status: existing.status };
    }
    if (existing) await this.destroyClient(userId);

    const puppeteer = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteer.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: dataPath(),
      }),
      puppeteer,
    });

    const entry = { client, status: "initializing" };
    this.clients.set(userId, entry);

    client.on("qr", async (qr) => {
      try {
        const dataUrl = await qrcode.toDataURL(qr);
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await this.upsertSession(userId, {
          status: "qr_ready",
          qr_code_base64: base64,
        });
      } catch (error) {
        console.error("qr", userId, error);
      }
    });

    client.on("ready", async () => {
      const current = this.clients.get(userId);
      if (current) current.status = "ready";
      await this.upsertSession(userId, {
        status: "connected",
        qr_code_base64: null,
      });
      console.log("ready", userId);
    });

    client.on("auth_failure", async (message) => {
      console.error("auth_failure", userId, message);
      const current = this.clients.get(userId);
      if (current) current.status = "disconnected";
      await this.upsertSession(userId, {
        status: "disconnected",
        qr_code_base64: null,
      });
    });

    client.on("disconnected", async (reason) => {
      console.error("disconnected", userId, reason);
      const current = this.clients.get(userId);
      if (current) current.status = "disconnected";
      this.clients.delete(userId);
      await this.upsertSession(userId, {
        status: "disconnected",
        qr_code_base64: null,
      });
      try {
        await client.destroy();
      } catch (error) {
        console.error("destroy after disconnect", userId, error);
      }
    });

    client.initialize().catch(async (error) => {
      console.error("initialize", userId, error);
      const current = this.clients.get(userId);
      if (current) current.status = "disconnected";
      await this.upsertSession(userId, {
        status: "disconnected",
        qr_code_base64: null,
      });
    });

    return { status: "initializing" };
  }

  async disconnect(userId) {
    const entry = this.clients.get(userId);
    if (entry) {
      this.clients.delete(userId);
      try {
        await entry.client.logout();
      } catch (error) {
        console.error("logout", userId, error);
        try {
          await entry.client.destroy();
        } catch (destroyError) {
          console.error("destroy", userId, destroyError);
        }
      }
    }
    await this.upsertSession(userId, {
      status: "disconnected",
      qr_code_base64: null,
    });
  }

  async syncChats(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.status !== "ready") {
      throw new Error("WhatsApp no está conectado");
    }

    const chats = await entry.client.getChats();
    const rows = [];
    for (const chat of chats) {
      const waId = chat.id?._serialized;
      const isGroup = classifyChat(waId, Boolean(chat.isGroup));
      if (isGroup === null) continue;
      rows.push({
        user_id: userId,
        wa_id: waId,
        name: chat.name || waId,
        is_group: isGroup,
        updated_at: new Date().toISOString(),
      });
    }

    for (let index = 0; index < rows.length; index += 200) {
      const chunk = rows.slice(index, index + 200);
      const { error } = await this.supabase
        .from("chats")
        .upsert(chunk, { onConflict: "user_id,wa_id" });
      if (error) throw new Error(error.message);
    }

    return { count: rows.length };
  }

  async restoreSessions() {
    const directory = dataPath();
    if (!fs.existsSync(directory)) return;

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("session-")) continue;
      const userId = entry.name.slice("session-".length);
      if (!UUID_PATTERN.test(userId)) continue;
      console.log("restore", userId);
      await this.connect(userId);
    }
  }
}

module.exports = { SessionManager };
