const fs = require("fs");
const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode");
const { log } = require("./log");
const { credsAreRegistered, persistCreds, readStoredCreds, deleteCreds } = require("./auth-store");
const { absorbChat, absorbMessage, groupChatRows } = require("./unread");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_LINK_ATTEMPTS = 3;
const MAX_RESTARTS = 5;
const RETRY_DELAY_MS = 3000;
const STALE_INITIALIZING_MS = 120000;
const STALE_QR_MS = 300000;
const STALE_AUTHENTICATING_MS = 180000;
const WATCH_MS = 8000;
const HISTORY_SYNC_FULL = 2;
const CLOSE_CONNECTION_LOST = 408;
const CLOSE_CONNECTION_CLOSED = 428;
const CLOSE_LOGGED_OUT = 401;
const CLOSE_RESTART_REQUIRED = 515;
const CLOSE_BAD_SESSION = 500;
const RECONNECT_PAUSE_MS = 15000;

const logger = pino({ level: "error" });

let baileysPromise;

function loadBaileys() {
  if (!baileysPromise) {
    baileysPromise = import("@whiskeysockets/baileys");
  }
  return baileysPromise;
}

function dataPath() {
  return process.env.BAILEYS_DATA_PATH || path.join(__dirname, ".baileys");
}

function sessionDir(userId) {
  return path.join(dataPath(), `session-${userId}`);
}

function credsPath(userId) {
  return path.join(sessionDir(userId), "creds.json");
}

function sessionIsRegistered(userId) {
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath(userId), "utf8"));
    return Boolean(creds.registered);
  } catch {
    return false;
  }
}

function discardSession(userId) {
  fs.rmSync(sessionDir(userId), { recursive: true, force: true });
  log("perfil", `${userId} sesión en disco eliminada`);
}

function mbFromKb(kb) {
  return Math.round(kb / 1024);
}

function readMemory() {
  let totalKb = 0;
  let availableKb = 0;
  try {
    const text = fs.readFileSync("/proc/meminfo", "utf8");
    const total = text.match(/MemTotal:\s+(\d+)/);
    const available = text.match(/MemAvailable:\s+(\d+)/);
    totalKb = total ? Number(total[1]) : 0;
    availableKb = available ? Number(available[1]) : 0;
  } catch {
    totalKb = 0;
    availableKb = 0;
  }
  return {
    totalKb,
    availableKb,
    rssKb: Math.round(process.memoryUsage().rss / 1024),
  };
}

function describeMemory(snap = readMemory()) {
  if (!snap.totalKb) return "memoria no disponible";
  return `memoria total=${mbFromKb(snap.totalKb)}MB libre=${mbFromKb(snap.availableKb)}MB node=${mbFromKb(snap.rssKb)}MB`;
}

function linkStatusForEntry(entry) {
  if (!entry || entry.closing) return "interrupted";
  if (entry.status === "ready") return "connected";
  if (entry.status === "qr") return "qr_ready";
  if (entry.status === "authenticating") return "authenticating";
  return "connecting";
}

function reconnectDelayMs(restarts) {
  const steps = [500, 1000, 2000, 5000, 10000, RECONNECT_PAUSE_MS];
  return steps[Math.min(restarts, steps.length - 1)];
}

function shouldDiscardSession({ fresh, consumeAttempt, registered }) {
  if (registered) return false;
  return Boolean(fresh || consumeAttempt);
}

function outcomeForConnection({
  status,
  connection,
  qr,
  isNewLogin,
  statusCode,
  registered,
} = {}) {
  if (qr) {
    return { action: "qr", memoryStatus: "qr", dbStatus: "qr_ready" };
  }
  if (isNewLogin) {
    return {
      action: "authenticating",
      memoryStatus: "authenticating",
      dbStatus: "authenticating",
    };
  }
  if (connection === "open") {
    return { action: "ready", memoryStatus: "ready", dbStatus: "connected" };
  }
  if (connection === "connecting") {
    if (status === "qr" || status === "authenticating") {
      return {
        action: "authenticating",
        memoryStatus: "authenticating",
        dbStatus: "authenticating",
      };
    }
    return {
      action: "connecting",
      memoryStatus: status || "initializing",
      dbStatus: "connecting",
    };
  }
  if (connection === "close") {
    if (statusCode === CLOSE_LOGGED_OUT) return { action: "logout" };
    if (statusCode === CLOSE_BAD_SESSION && !registered) {
      return { action: "retry-fresh" };
    }
    if (
      statusCode === CLOSE_RESTART_REQUIRED ||
      registered ||
      status === "ready" ||
      (statusCode === CLOSE_CONNECTION_CLOSED && status !== "qr") ||
      (statusCode === CLOSE_CONNECTION_LOST && status !== "qr")
    ) {
      return { action: "reconnect" };
    }
    return { action: "retry" };
  }
  return { action: "ignore" };
}

function shouldSyncHistory(syncType) {
  return syncType !== HISTORY_SYNC_FULL;
}

function toBaileysJid(waId) {
  if (typeof waId !== "string") return waId;
  if (waId.endsWith("@c.us")) return `${waId.slice(0, -5)}@s.whatsapp.net`;
  return waId;
}

function closeStatusCode(update) {
  return update?.lastDisconnect?.error?.output?.statusCode;
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

function chatName(chat) {
  return String(chat.name || chat.subject || chat.notify || chat.verifiedName || "")
    .replaceAll("\u0000", "")
    .trim();
}

function historyMessage(item) {
  if (item?.key) return item;
  if (item?.message?.key) return item.message;
  return null;
}

function rememberChat(chats, chat) {
  if (!chat?.id) return false;
  const isGroup = classifyChat(
    chat.id,
    Boolean(chat.isGroup || chat.id.endsWith("@g.us")),
  );
  if (isGroup === null) return false;
  const { state, changed } = absorbChat(
    chats.get(chat.id),
    { ...chat, name: chatName(chat) },
    isGroup,
  );
  chats.set(chat.id, state);
  let dirty = changed;
  if (Array.isArray(chat.messages)) {
    for (const item of chat.messages) {
      const message = historyMessage(item);
      if (!message) continue;
      if (absorbMessage(state, message).changed) dirty = true;
    }
  }
  return dirty;
}

class SessionManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.clients = new Map();
    this.restoreFinished = false;
  }

  getClient(userId) {
    return this.clients.get(userId)?.sock ?? null;
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

  stopMemory(entry) {
    if (!entry?.memoryWatch) return;
    clearInterval(entry.memoryWatch);
    entry.memoryWatch = null;
  }

  async safeEnd(sock) {
    try {
      sock.end(undefined);
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
      const keepCreds = existing.registered || sessionIsRegistered(userId);
      existing.closing = true;
      existing.generation += 1;
      this.stopMemory(existing);
      this.clients.delete(userId);
      await this.safeEnd(existing.sock);
      if (failedEarly && !keepCreds) discardSession(userId);
    }

    const registered = await this.prepareAuth(userId);
    log(
      "connect",
      `${userId} iniciando intento 1 registrada=${registered} ${describeMemory()}`,
    );
    if (!registered) {
      await this.upsertSession(userId, {
        status: "connecting",
        qr_code_base64: null,
      });
    }
    await this.launch(userId, 1, 1, 0);
    return { status: registered ? "connected" : "connecting" };
  }

  async prepareAuth(userId) {
    if (sessionIsRegistered(userId)) return true;
    const body = await readStoredCreds(this.supabase, userId);
    if (!body) return false;
    discardSession(userId);
    fs.mkdirSync(sessionDir(userId), { recursive: true });
    fs.writeFileSync(credsPath(userId), body);
    log("perfil", `${userId} credencial restaurada`);
    return true;
  }

  async launch(userId, attempt, generation, restarts) {
    await this.prepareAuth(userId);
    const { default: makeWASocket, useMultiFileAuthState } = await loadBaileys();
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir(userId));
    log(
      "launch",
      `${userId} intento ${attempt} reinicios=${restarts} ${describeMemory()}`,
    );

    const sock = makeWASocket({
      auth: state,
      logger,
      browser: ["Ubuntu", "SoyGerman", "22.04.4"],
      syncFullHistory: false,
      shouldSyncHistoryMessage: ({ syncType }) => shouldSyncHistory(syncType),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid) =>
        !jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter"),
    });

    const entry = {
      sock,
      chats: new Map(),
      status: "initializing",
      attempt,
      generation,
      restarts,
      startedAt: Date.now(),
      closing: false,
      retrying: false,
      registered: credsAreRegistered(state.creds),
    };
    this.clients.set(userId, entry);

    const still = () => {
      const current = this.clients.get(userId);
      return (
        current &&
        current.sock === sock &&
        current.generation === generation &&
        !current.closing
      );
    };

    let credsWrite = Promise.resolve();
    entry.flushCreds = () => credsWrite;
    sock.ev.on("creds.update", () => {
      credsWrite = credsWrite
        .then(async () => {
          await saveCreds();
          if (sessionIsRegistered(userId)) {
            entry.registered = true;
            await persistCreds(this.supabase, userId, credsPath(userId));
          }
        })
        .catch((error) => {
          log(
            "perfil",
            `${userId} no guardó credenciales: ${error.message || error}`,
          );
        });
    });

    const take = (items) => {
      if (!still() || !Array.isArray(items)) return false;
      let changed = false;
      for (const item of items) {
        if (rememberChat(entry.chats, item)) changed = true;
      }
      return changed;
    };
    const noteMessages = (messages, notify) => {
      if (!still() || !Array.isArray(messages)) return false;
      let changed = false;
      for (const item of messages) {
        const message = historyMessage(item);
        const jid = message?.key?.remoteJid;
        if (!jid) continue;
        if (!entry.chats.has(jid)) rememberChat(entry.chats, { id: jid });
        const state = entry.chats.get(jid);
        if (!state) continue;
        if (absorbMessage(state, message, { notify }).changed) changed = true;
      }
      return changed;
    };
    sock.ev.on("messaging-history.set", ({ chats, contacts, messages }) => {
      const changed = take(chats) || take(contacts) || noteMessages(messages, false);
      if (!still()) return;
      log("sync", `${userId} historial parcial chats=${entry.chats.size}`);
      this.scheduleAutoSync(userId);
      if (changed) this.scheduleUnreadFlush(userId);
    });
    sock.ev.on("chats.upsert", (items) => {
      if (take(items)) this.scheduleUnreadFlush(userId);
    });
    sock.ev.on("chats.update", (items) => {
      if (take(items)) this.scheduleUnreadFlush(userId);
    });
    sock.ev.on("contacts.upsert", take);
    sock.ev.on("contacts.update", take);
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (noteMessages(messages, type === "notify")) {
        this.scheduleUnreadFlush(userId);
      }
    });

    sock.ev.on("connection.update", (update) => {
      void this.onConnectionUpdate(userId, sock, generation, update);
    });

    entry.memoryWatch = setInterval(() => {
      if (!still() || entry.status === "ready") {
        this.stopMemory(entry);
        return;
      }
      log(
        "memoria",
        `${userId} status=${entry.status} intento=${entry.attempt} ${describeMemory()}`,
      );
    }, WATCH_MS);
  }

  async onConnectionUpdate(userId, sock, generation, update) {
    const entry = this.clients.get(userId);
    if (
      !entry ||
      entry.sock !== sock ||
      entry.generation !== generation ||
      entry.closing ||
      entry.retrying
    ) {
      return;
    }

    const outcome = outcomeForConnection({
      status: entry.status,
      connection: update.connection,
      qr: update.qr,
      isNewLogin: update.isNewLogin,
      statusCode: closeStatusCode(update),
      registered: entry.registered || sessionIsRegistered(userId),
    });

    if (outcome.action === "ignore" || outcome.action === "connecting") return;

    if (outcome.action === "qr") {
      if (entry.registered || entry.status === "ready") {
        log("qr", `${userId} inesperado con sesión registrada; se reabre`);
        await this.relaunch(userId, sock, generation, {
          fresh: false,
          consumeAttempt: false,
        });
        return;
      }
      if (entry.status === "authenticating") return;
      entry.status = "qr";
      entry.startedAt = Date.now();
      log("qr", `${userId} recibido largo=${update.qr.length}`);
      try {
        const dataUrl = await qrcode.toDataURL(update.qr);
        if (
          !this.clients.get(userId) ||
          this.clients.get(userId).sock !== sock ||
          entry.closing ||
          entry.status !== "qr"
        ) {
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
      return;
    }

    if (outcome.action === "authenticating") {
      if (entry.status === "ready") return;
      entry.status = "authenticating";
      entry.startedAt = Date.now();
      await this.upsertSession(userId, { status: "authenticating" });
      log("authenticated", userId);
      return;
    }

    if (outcome.action === "ready") {
      this.stopMemory(entry);
      entry.status = "ready";
      entry.registered = true;
      entry.retrying = false;
      entry.restarts = 0;
      await this.upsertSession(userId, {
        status: "connected",
        qr_code_base64: null,
      });
      if (entry.flushCreds) await entry.flushCreds();
      await persistCreds(this.supabase, userId, credsPath(userId));
      log("ready", `${userId} ${describeMemory()}`);
      this.scheduleAutoSync(userId);
      return;
    }

    if (outcome.action === "logout") {
      entry.closing = true;
      this.stopAutoSync(entry);
      this.stopUnreadFlush(entry);
      this.stopMemory(entry);
      this.clients.delete(userId);
      log("disconnected", `${userId} logout`);
      discardSession(userId);
      await deleteCreds(this.supabase, userId);
      await this.markDisconnected(userId);
      return;
    }

    const fresh = outcome.action === "retry-fresh";
    log(
      "disconnected",
      `${userId} cierre ${closeStatusCode(update)} accion=${outcome.action}`,
    );
    await this.relaunch(userId, sock, generation, {
      fresh,
      consumeAttempt: outcome.action !== "reconnect",
    });
  }

  async relaunch(userId, sock, generation, { fresh, consumeAttempt }) {
    const entry = this.clients.get(userId);
    if (
      !entry ||
      entry.closing ||
      entry.sock !== sock ||
      entry.generation !== generation ||
      entry.retrying
    ) {
      return;
    }

    const wasReady = entry.status === "ready";
    entry.retrying = true;
    entry.status = "initializing";
    this.stopMemory(entry);
    const attempt = entry.attempt;
    const nextRestarts = consumeAttempt ? 0 : entry.restarts + 1;
    const giveUp =
      (consumeAttempt && attempt >= MAX_LINK_ATTEMPTS) ||
      nextRestarts > MAX_RESTARTS;

    if (entry.flushCreds) await entry.flushCreds();
    await this.safeEnd(sock);

    const registered = entry.registered || sessionIsRegistered(userId);
    if (shouldDiscardSession({ fresh, consumeAttempt, registered })) {
      discardSession(userId);
    }

    if (giveUp && registered) {
      log(
        "reintento",
        `${userId} espera ${RECONNECT_PAUSE_MS}ms para reabrir la sesión`,
      );
      entry.restarts = 0;
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_PAUSE_MS));
    } else if (giveUp) {
      this.clients.delete(userId);
      if (wasReady && !fresh) await this.markClosed(userId, "interrupted");
      else await this.markClosed(userId, "disconnected");
      log("reintento", `${userId} agotado tras ${attempt} intentos`);
      return;
    }

    if (!wasReady && !registered) {
      await this.upsertSession(userId, {
        status: "connecting",
        qr_code_base64: null,
      });
    }
    const waitMs = consumeAttempt ? RETRY_DELAY_MS : reconnectDelayMs(nextRestarts);
    if (waitMs && !(giveUp && registered)) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const current = this.clients.get(userId);
    if (
      !current ||
      current.sock !== sock ||
      current.generation !== generation ||
      current.closing
    ) {
      return;
    }

    const nextAttempt = consumeAttempt ? attempt + 1 : attempt;
    const launchRestarts = giveUp && registered ? 0 : nextRestarts;
    try {
      await this.launch(userId, nextAttempt, generation + 1, launchRestarts);
    } catch (error) {
      log("launch", `${userId} falló: ${error.message || error}`);
      const launched = this.clients.get(userId);
      if (launched && launched.sock !== sock) return;
      this.clients.delete(userId);
      if (!sessionIsRegistered(userId) && !registered) discardSession(userId);
      if (registered || wasReady) await this.markClosed(userId, "interrupted");
      else await this.markClosed(userId, "disconnected");
    }
  }

  async disconnect(userId) {
    const entry = this.clients.get(userId);
    if (entry) {
      entry.closing = true;
      entry.generation += 1;
      this.stopAutoSync(entry);
      this.stopUnreadFlush(entry);
      this.stopMemory(entry);
      this.clients.delete(userId);
      try {
        await entry.sock.logout();
      } catch (error) {
        log("logout", `${userId} ${error.message || error}`);
        await this.safeEnd(entry.sock);
      }
    }
    discardSession(userId);
    await deleteCreds(this.supabase, userId);
    await this.markDisconnected(userId);
  }

  async markDisconnected(userId) {
    await this.markClosed(userId, "disconnected", { clear: true });
  }

  async markClosed(userId, status, { clear = false } = {}) {
    await this.upsertSession(userId, {
      status,
      qr_code_base64: null,
    });
    if (!clear) return;
    await this.clearChats(userId, "WhatsApp se desconectó");
  }

  async publishLinkStatus(userId, entry) {
    if (entry?.registered) return;
    const status = linkStatusForEntry(entry);
    if (status === "connected" || status === "interrupted") return;
    await this.upsertSession(userId, { status });
  }

  async interrupt(userId, { force = false } = {}) {
    if (!this.restoreFinished && !force) return false;
    const entry = this.clients.get(userId);
    if (!force && entry?.status === "ready") return false;
    if (!force && entry && (entry.closing || this.isLinkInProgress(entry))) {
      return false;
    }
    if (entry) {
      entry.closing = true;
      entry.generation += 1;
      this.stopAutoSync(entry);
      this.stopUnreadFlush(entry);
      this.stopMemory(entry);
      this.clients.delete(userId);
      void this.safeEnd(entry.sock);
    }
    if (this.clients.has(userId)) return false;

    if (await this.prepareAuth(userId)) {
      log("sesión", `${userId} se reabre con la credencial guardada`);
      await this.connect(userId);
      return false;
    }

    const { data, error } = await this.supabase
      .from("whatsapp_sessions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      log("sesión", `no se leyó ${userId}: ${error.message}`);
      return false;
    }
    if (
      !data ||
      data.status === "disconnected" ||
      data.status === "interrupted"
    ) {
      return false;
    }
    log("sesión", `${userId} pasó de ${data.status} a interrupted`);
    await this.markClosed(userId, "interrupted");
    return true;
  }

  async clearChats(userId, errorMessage = "WhatsApp se desconectó") {
    const { error: messageError } = await this.supabase
      .from("scheduled_messages")
      .update({
        status: "failed",
        error_message: errorMessage,
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

  stopAutoSync(entry) {
    if (!entry?.autoSyncTimer) return;
    clearTimeout(entry.autoSyncTimer);
    entry.autoSyncTimer = null;
  }

  stopUnreadFlush(entry) {
    if (!entry?.unreadFlush) return;
    clearTimeout(entry.unreadFlush);
    entry.unreadFlush = null;
  }

  scheduleUnreadFlush(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.closing || entry.status !== "ready" || entry.unreadFlush) {
      return;
    }
    entry.unreadFlush = setTimeout(() => {
      entry.unreadFlush = null;
      const current = this.clients.get(userId);
      if (!current || current.closing || current.status !== "ready") return;
      void this.flushUnread(userId);
    }, 4000);
  }

  async upsertChatRows(userId, chats) {
    const now = new Date().toISOString();
    const groups = groupChatRows(userId, chats, now);
    for (const rows of groups) {
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
    }
  }

  async flushUnread(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.closing || entry.status !== "ready" || entry.syncing) {
      if (entry?.syncing) this.scheduleUnreadFlush(userId);
      return;
    }
    const dirty = [...entry.chats.values()].filter((chat) => chat.dirty);
    if (dirty.length === 0) return;
    for (const chat of dirty) chat.dirty = false;
    try {
      await this.upsertChatRows(userId, dirty);
      log("sync", `${userId} no leídos actualizados ${dirty.length}`);
    } catch (error) {
      for (const chat of dirty) chat.dirty = true;
      log("sync", `${userId} no guardó no leídos: ${error.message || error}`);
    }
  }

  scheduleAutoSync(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.closing) return;
    this.stopAutoSync(entry);
    entry.autoSyncTimer = setTimeout(() => {
      const current = this.clients.get(userId);
      if (
        !current ||
        current.closing ||
        current.status !== "ready" ||
        current.syncing
      ) {
        return;
      }
      if (current.chats.size === 0) {
        current.autoSyncTries = (current.autoSyncTries ?? 0) + 1;
        if (current.autoSyncTries <= 6) this.scheduleAutoSync(userId);
        return;
      }
      current.autoSyncTries = 0;
      current.syncing = true;
      this.syncChats(userId)
        .catch((error) => {
          log("sync", `${userId} automático falló: ${error.message || error}`);
        })
        .finally(() => {
          current.syncing = false;
        });
    }, 5000);
  }

  async syncChats(userId) {
    const entry = this.clients.get(userId);
    if (!entry || entry.status !== "ready") {
      if (entry && this.isLinkInProgress(entry)) {
        await this.publishLinkStatus(userId, entry);
        throw new Error("WhatsApp todavía se está conectando.");
      }
      await this.interrupt(userId);
      throw new Error(
        "La conexión con WhatsApp se interrumpió. Vuelve a vincular.",
      );
    }

    log("sync", `${userId} leyendo chats ${describeMemory()}`);
    try {
      const groups = await entry.sock.groupFetchAllParticipating();
      for (const group of Object.values(groups || {})) {
        rememberChat(entry.chats, {
          id: group.id,
          name: group.subject,
          isGroup: true,
        });
      }
    } catch (error) {
      log("sync", `${userId} no leyó grupos: ${error.message || error}`);
      if (entry.status !== "ready" || entry.closing) {
        await this.interrupt(userId, { force: true });
        throw new Error(
          "La conexión con WhatsApp se interrumpió. Vuelve a vincular.",
        );
      }
    }

    if (entry.chats.size === 0) {
      throw new Error("No se pudo leer la lista de chats de WhatsApp");
    }

    const chats = [...entry.chats.values()];
    for (const chat of chats) chat.dirty = false;
    // No incluir `hidden`: el upsert no debe devolver un chat que la persona quitó.
    await this.upsertChatRows(userId, chats);
    if ([...entry.chats.values()].some((chat) => chat.dirty)) {
      this.scheduleUnreadFlush(userId);
    }

    log("sync", `${userId} guardados ${chats.length}`);
    return { count: chats.length };
  }

  async restoreSessions() {
    try {
      const directory = dataPath();
      if (fs.existsSync(directory)) {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        for (const item of entries) {
          if (!item.isDirectory() || !item.name.startsWith("session-")) {
            continue;
          }
          const userId = item.name.slice("session-".length);
          if (!UUID_PATTERN.test(userId)) continue;
          if (!(await this.prepareAuth(userId))) {
            log(
              "restore",
              `${userId} sin sesión lista; se borra el perfil a medias ${describeMemory()}`,
            );
            discardSession(userId);
            continue;
          }
          log("restore", `${userId} ${describeMemory()}`);
          await this.connect(userId);
        }
      }
    } catch (error) {
      log("restore", error.message || String(error));
    } finally {
      this.restoreFinished = true;
    }
    await this.reconcileStaleSessions();
  }

  async reconcileStaleSessions() {
    const { data, error } = await this.supabase
      .from("whatsapp_sessions")
      .select("user_id, status")
      .in("status", ["connected", "interrupted"]);
    if (error) {
      log("restore", `no se revisaron sesiones: ${error.message}`);
      return;
    }
    for (const row of data || []) {
      if (this.clients.has(row.user_id)) continue;
      await this.interrupt(row.user_id);
    }
  }
}

module.exports = {
  SessionManager,
  describeMemory,
  linkStatusForEntry,
  outcomeForConnection,
  shouldDiscardSession,
  shouldSyncHistory,
  toBaileysJid,
  CLOSE_CONNECTION_LOST,
  CLOSE_CONNECTION_CLOSED,
  CLOSE_LOGGED_OUT,
  CLOSE_RESTART_REQUIRED,
  CLOSE_BAD_SESSION,
  HISTORY_SYNC_FULL,
};
