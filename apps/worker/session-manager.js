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
const STALE_INITIALIZING_MS = 120000;
const STALE_QR_MS = 300000;
const STALE_AUTHENTICATING_MS = 180000;
const WATCH_MS = 8000;
const PROFILE_LOCKS = ["SingletonLock", "SingletonCookie", "SingletonSocket"];

function dataPath() {
  return process.env.WWEBJS_DATA_PATH || path.join(__dirname, ".wwebjs_auth");
}

function sessionDir(userId) {
  return path.join(dataPath(), `session-${userId}`);
}

function releaseProfileLocks(userId) {
  const dir = sessionDir(userId);
  for (const name of PROFILE_LOCKS) {
    try {
      fs.rmSync(path.join(dir, name), { force: true });
    } catch (error) {
      log("perfil", `${userId} ${name}: ${error.message || error}`);
    }
  }
}

function stopOrphanBrowser(userId) {
  const marker = `session-${userId}`;
  let pids = [];
  try {
    pids = fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name));
  } catch {
    return;
  }
  for (const pid of pids) {
    if (Number(pid) === process.pid) continue;
    let cmdline = "";
    try {
      cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    } catch {
      continue;
    }
    const text = cmdline.replaceAll("\u0000", " ");
    if (!text.includes(marker) || !text.toLowerCase().includes("chrom")) continue;
    try {
      process.kill(Number(pid), "SIGKILL");
      log("perfil", `${userId} cerró chromium ${pid}`);
    } catch (error) {
      log("perfil", `${userId} no cerró ${pid}: ${error.message || error}`);
    }
  }
}

function discardSession(userId) {
  stopOrphanBrowser(userId);
  fs.rmSync(sessionDir(userId), { recursive: true, force: true });
  log("perfil", `${userId} sesión en disco eliminada`);
}

function prepareProfile(userId) {
  stopOrphanBrowser(userId);
  releaseProfileLocks(userId);
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
    if (!entry || entry.closing) return false;
    if (entry.status === "ready" || entry.retrying) return true;
    const age = Date.now() - entry.startedAt;
    if (entry.status === "authenticating") return age < STALE_AUTHENTICATING_MS;
    if (entry.status === "qr") return age < STALE_QR_MS;
    if (entry.status === "initializing") return age < STALE_INITIALIZING_MS;
    return false;
  }

  stopWatch(entry) {
    if (!entry?.watch) return;
    clearInterval(entry.watch);
    entry.watch = null;
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
      const failedEarly = existing.status !== "ready";
      existing.closing = true;
      existing.generation += 1;
      this.stopWatch(existing);
      this.clients.delete(userId);
      await this.safeDestroy(existing.client);
      if (failedEarly) discardSession(userId);
    }

    prepareProfile(userId);
    log("connect", `${userId} iniciando intento 1`);
    await this.upsertSession(userId, {
      status: "connecting",
      qr_code_base64: null,
    });
    await this.launch(userId, 1);
    return { status: "connecting" };
  }

  async launch(userId, attempt, generation = 1) {
    prepareProfile(userId);
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
      takeoverOnConflict: true,
      takeoverTimeoutMs: 3000,
      deviceName: "SoyGerman",
      browserName: "SoyGerman",
    });

    const entry = {
      client,
      status: "initializing",
      attempt,
      generation,
      startedAt: Date.now(),
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
      entry.status = "qr";
      entry.startedAt = Date.now();
      log("qr", `${userId} recibido largo=${qr.length}`);
      try {
        const dataUrl = await qrcode.toDataURL(qr);
        if (!stillThisClient()) return;
        if (entry.status !== "qr") {
          log("qr", `${userId} ignorado porque el estado ya es ${entry.status}`);
          return;
        }
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await this.upsertSession(userId, {
          status: "qr_ready",
          qr_code_base64: base64,
        });
        log("qr", `${userId} guardado bytes=${base64.length}`);
      } catch (error) {
        log("qr", `${userId} falló: ${error.message || error}`);
      }
    });

    client.on("loading_screen", (percent, message) => {
      log("loading_screen", `${userId} ${percent}% ${message || ""}`.trim());
    });

    client.on("change_state", (state) => {
      log("change_state", `${userId} ${state}`);
    });

    client.on("authenticated", async () => {
      if (!stillThisClient()) return;
      entry.status = "authenticating";
      entry.startedAt = Date.now();
      await this.upsertSession(userId, { status: "authenticating" });
      log("authenticated", userId);
    });

    client.on("ready", async () => {
      if (!stillThisClient()) return;
      this.stopWatch(entry);
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

    entry.watch = setInterval(() => {
      const current = this.clients.get(userId);
      if (
        !current ||
        current.client !== client ||
        current.generation !== generation ||
        current.closing ||
        current.status === "ready"
      ) {
        this.stopWatch(current || entry);
        return;
      }
      void this.watchLink(userId, client, generation);
    }, WATCH_MS);

    client.initialize().catch((error) => {
      log("initialize", `${userId} falló: ${error.message || error}`);
      this.scheduleRetry(userId, client, generation, error);
    });
  }

  async watchLink(userId, client, generation) {
    const entry = this.clients.get(userId);
    if (
      !entry ||
      entry.client !== client ||
      entry.generation !== generation ||
      entry.closing ||
      entry.status === "ready"
    ) {
      this.stopWatch(entry);
      return;
    }

    const page = client.pupPage;
    if (!page) {
      log("watch", `${userId} aún sin página estado=${entry.status}`);
      return;
    }

    if (!entry.consoleBound) {
      entry.consoleBound = true;
      page.on("pageerror", (error) => {
        log("pageerror", `${userId} ${error.message || error}`);
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        log("console", `${userId} ${message.text().slice(0, 300)}`);
      });
    }

    let snapshot;
    try {
      snapshot = await page.evaluate(() => {
        let state = "sin-socket";
        let hasSynced = false;
        try {
          const socket = window.require("WAWebSocketModel").Socket;
          state = socket.state || "sin-estado";
          hasSynced = Boolean(socket.hasSynced);
        } catch {
          state = "sin-socket";
        }
        const text = (document.body?.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180);
        return {
          state,
          hasSynced,
          wwebjs: typeof window.WWebJS !== "undefined",
          text,
        };
      });
    } catch (error) {
      log("watch", `${userId} no leyó la página: ${error.message || error}`);
      return;
    }

    log(
      "watch",
      `${userId} estado=${snapshot.state} hasSynced=${snapshot.hasSynced} wwebjs=${snapshot.wwebjs} ui="${snapshot.text}"`,
    );

    if (snapshot.state === "CONFLICT" && !entry.tookOver) {
      entry.tookOver = true;
      log("watch", `${userId} hay otra sesión de WhatsApp Web; tomando el control`);
      try {
        await page.evaluate(() => {
          window.require("WAWebSocketModel").Socket.takeover();
        });
      } catch (error) {
        log("watch", `${userId} takeover falló: ${error.message || error}`);
      }
      return;
    }

    const linked =
      snapshot.hasSynced ||
      snapshot.state === "CONNECTED" ||
      snapshot.wwebjs;
    if (!linked || entry.nudged || entry.status === "authenticating") return;

    entry.nudged = true;
    log(
      "watch",
      `${userId} el navegador ya está vinculado y el evento de sincronización no llegó; continuando`,
    );
    try {
      const result = await page.evaluate(() => {
        if (typeof window.onAppStateHasSyncedEvent === "function") {
          return window.onAppStateHasSyncedEvent();
        }
        return "sin-callback";
      });
      if (result === "sin-callback") {
        entry.nudged = false;
        log("watch", `${userId} el callback de sincronización todavía no existe`);
      }
    } catch (error) {
      log("watch", `${userId} no pudo continuar: ${error.message || error}`);
      entry.nudged = false;
    }
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
    this.stopWatch(entry);
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

    const current = this.clients.get(userId);
    if (current && current.status !== "ready") discardSession(userId);

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
      this.stopWatch(entry);
      this.clients.delete(userId);
      try {
        await entry.client.logout();
      } catch (error) {
        log("logout", `${userId} ${error.message || error}`);
        await this.safeDestroy(entry.client);
        discardSession(userId);
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
