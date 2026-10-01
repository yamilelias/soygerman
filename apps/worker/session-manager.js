const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const { log } = require("./log");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// whatsapp-web.js 1.34.2: con qrMaxRetries en 0 la librería sigue emitiendo
// `qr` hasta que se escanea. Un valor mayor corta y emite `disconnected`
// ("Max qrcode retries reached") sin crear otro cliente. Los fallos duros
// se reintentan aquí.
const QR_MAX_RETRIES = 0;
const MAX_LINK_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

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
      log(
        "sesión",
        `no se guardó ${userId} status=${fields.status || "sin cambio"}: ${error.message}`,
      );
    }
  }

  isLinkInProgress(entry) {
    return (
      entry &&
      !entry.closing &&
      (entry.retrying ||
        entry.status === "initializing" ||
        entry.status === "authenticating" ||
        entry.status === "ready")
    );
  }

  async safeDestroy(client) {
    try {
      await client.destroy();
    } catch (error) {
      log("destroy", error.message || String(error));
    }
  }

  async connect(userId) {
    const existing = this.clients.get(userId);
    if (this.isLinkInProgress(existing)) {
      log(
        "connect",
        `${userId} ya en curso status=${existing.status} intento=${existing.attempt}`,
      );
      return {
        status: existing.status === "ready" ? "connected" : "connecting",
      };
    }
    if (existing) {
      existing.closing = true;
      existing.generation += 1;
      this.clients.delete(userId);
      await this.safeDestroy(existing.client);
    }

    log("connect", `${userId} iniciando intento 1`);
    await this.upsertSession(userId, {
      status: "connecting",
      qr_code_base64: null,
    });
    await this.launch(userId, 1);
    return { status: "connecting" };
  }

  async launch(userId, attempt, generation = 1) {
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
    log(
      "launch",
      `${userId} intento ${attempt} chrome ${puppeteer.executablePath || "puppeteer"}`,
    );

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: dataPath(),
      }),
      puppeteer,
      qrMaxRetries: QR_MAX_RETRIES,
    });

    const entry = {
      client,
      status: "initializing",
      attempt,
      generation,
      closing: false,
      retrying: false,
    };
    this.clients.set(userId, entry);

    const stillThisClient = () => {
      const current = this.clients.get(userId);
      return (
        current &&
        current.client === client &&
        current.generation === generation &&
        !current.closing
      );
    };

    client.on("qr", async (qr) => {
      if (!stillThisClient()) return;
      if (entry.status === "authenticating" || entry.status === "ready") return;
      try {
        const dataUrl = await qrcode.toDataURL(qr);
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await this.upsertSession(userId, {
          status: "qr_ready",
          qr_code_base64: base64,
        });
        log("qr", `${userId} listo bytes=${base64.length}`);
      } catch (error) {
        log("qr", `${userId} falló: ${error.message || error}`);
      }
    });

    client.on("authenticated", async () => {
      if (!stillThisClient()) return;
      entry.status = "authenticating";
      await this.upsertSession(userId, { status: "authenticating" });
      log("authenticated", userId);
    });

    client.on("ready", async () => {
      if (!stillThisClient()) return;
      entry.status = "ready";
      entry.retrying = false;
      await this.upsertSession(userId, {
        status: "connected",
        qr_code_base64: null,
      });
      log("ready", userId);
    });

    client.on("auth_failure", (message) => {
      log("auth_failure", `${userId} ${message}`);
      this.scheduleRetry(userId, client, generation, message);
    });

    client.on("disconnected", (reason) => {
      log("disconnected", `${userId} ${reason}`);
      const current = this.clients.get(userId);
      if (!current || current.client !== client || current.closing) return;
      if (current.status === "ready") {
        current.closing = true;
        this.clients.delete(userId);
        void this.markDisconnected(userId);
        void this.safeDestroy(client);
        return;
      }
      this.scheduleRetry(userId, client, generation, reason);
    });

    client.initialize().catch((error) => {
      log("initialize", `${userId} falló: ${error.message || error}`);
      this.scheduleRetry(userId, client, generation, error);
    });
  }

  scheduleRetry(userId, client, generation, reason) {
    const entry = this.clients.get(userId);
    if (
      !entry ||
      entry.closing ||
      entry.client !== client ||
      entry.generation !== generation ||
      entry.retrying ||
      entry.status === "ready"
    ) {
      return;
    }
    entry.retrying = true;
    const attempt = entry.attempt;
    void this.retry(userId, client, generation, attempt, reason);
  }

  async retry(userId, client, generation, attempt, reason) {
    log("reintento", `${userId} intento ${attempt} motivo=${reason}`);
    await this.safeDestroy(client);

    const still = () => {
      const current = this.clients.get(userId);
      return (
        current &&
        current.client === client &&
        current.generation === generation &&
        !current.closing
      );
    };

    if (!still()) return;

    if (attempt >= MAX_LINK_ATTEMPTS) {
      this.clients.delete(userId);
      await this.markDisconnected(userId);
      log("reintento", `${userId} agotado tras ${attempt} intentos`);
      return;
    }

    await this.upsertSession(userId, {
      status: "connecting",
      qr_code_base64: null,
    });
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    if (!still()) return;
    await this.launch(userId, attempt + 1, generation);
  }

  async disconnect(userId) {
    const entry = this.clients.get(userId);
    if (entry) {
      entry.closing = true;
      entry.generation += 1;
      this.clients.delete(userId);
      try {
        await entry.client.logout();
      } catch (error) {
        log("logout", `${userId} ${error.message || error}`);
        await this.safeDestroy(entry.client);
      }
    }
    await this.markDisconnected(userId);
  }

  async markDisconnected(userId) {
    await this.upsertSession(userId, {
      status: "disconnected",
      qr_code_base64: null,
    });
    await this.clearChats(userId);
  }

  async clearChats(userId) {
    const { error: messageError } = await this.supabase
      .from("scheduled_messages")
      .update({
        status: "failed",
        error_message: "WhatsApp se desconectó",
      })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);
    if (messageError) {
      log(
        "chats",
        `no se cerraron pendientes ${userId}: ${messageError.message}`,
      );
    }

    const { error } = await this.supabase
      .from("chats")
      .delete()
      .eq("user_id", userId);
    if (error) {
      log("chats", `no se borraron ${userId}: ${error.message}`);
      return;
    }
    log("chats", `${userId} borrados`);
  }

  async syncChats(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.status !== "ready") {
      throw new Error("WhatsApp no está conectado");
    }

    log("sync", `${userId} leyendo chats`);
    let listed;
    try {
      listed = await entry.client.pupPage.evaluate(() => {
        const collection = window.require("WAWebCollections").Chat;
        return collection.getModelsArray().map((chat) => {
          const waId = chat.id && chat.id._serialized;
          const title = chat.formattedTitle || chat.name || waId;
          return {
            waId,
            name: title == null ? "" : String(title),
            isGroup: Boolean(chat.groupMetadata),
          };
        });
      });
    } catch (error) {
      log("sync", `${userId} no pudo leer chats: ${error.message || error}`);
      throw new Error("No se pudo leer la lista de chats de WhatsApp");
    }

    const now = new Date().toISOString();
    const byWaId = new Map();
    for (const chat of listed) {
      const isGroup = classifyChat(chat.waId, chat.isGroup);
      if (isGroup === null) continue;
      const name = chat.name.replaceAll("\u0000", "").trim() || chat.waId;
      byWaId.set(chat.waId, {
        user_id: userId,
        wa_id: chat.waId,
        name,
        is_group: isGroup,
        updated_at: now,
      });
    }
    const rows = [...byWaId.values()];

    for (let index = 0; index < rows.length; index += 200) {
      const chunk = rows.slice(index, index + 200);
      const { error } = await this.supabase
        .from("chats")
        .upsert(chunk, { onConflict: "user_id,wa_id" });
      if (error) {
        log("sync", `${userId} no se guardó: ${error.message}`);
        throw new Error(error.message);
      }
    }

    log("sync", `${userId} guardados ${rows.length}`);
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
      log("restore", userId);
      await this.connect(userId);
    }
  }
}

module.exports = { SessionManager };
