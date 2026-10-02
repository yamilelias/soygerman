const assert = require("node:assert/strict");
const test = require("node:test");
const {
  linkStatusForEntry,
  outcomeForConnection,
  shouldSyncHistory,
  toBaileysJid,
  CLOSE_LOGGED_OUT,
  CLOSE_RESTART_REQUIRED,
  CLOSE_BAD_SESSION,
  HISTORY_SYNC_FULL,
} = require("./session-manager");

test("sin cliente la sesión figura interrumpida", () => {
  assert.equal(linkStatusForEntry(null), "interrupted");
});

test("un cierre en curso no se publica como conectado", () => {
  assert.equal(
    linkStatusForEntry({ status: "ready", closing: true }),
    "interrupted",
  );
});

test("el estado en memoria se traduce al de la base", () => {
  assert.equal(linkStatusForEntry({ status: "ready" }), "connected");
  assert.equal(linkStatusForEntry({ status: "qr" }), "qr_ready");
  assert.equal(
    linkStatusForEntry({ status: "authenticating" }),
    "authenticating",
  );
  assert.equal(linkStatusForEntry({ status: "initializing" }), "connecting");
});

test("el código QR deja la sesión lista para escanear", () => {
  const outcome = outcomeForConnection({ qr: "abc", status: "initializing" });
  assert.equal(outcome.action, "qr");
  assert.equal(outcome.memoryStatus, "qr");
  assert.equal(outcome.dbStatus, "qr_ready");
});

test("el emparejamiento pasa a authenticating", () => {
  const outcome = outcomeForConnection({ isNewLogin: true, status: "qr" });
  assert.equal(outcome.action, "authenticating");
  assert.equal(outcome.dbStatus, "authenticating");
});

test("la sesión abierta queda conectada", () => {
  const outcome = outcomeForConnection({ connection: "open" });
  assert.equal(outcome.action, "ready");
  assert.equal(outcome.dbStatus, "connected");
});

test("un cierre que no es logout pide reintento", () => {
  const outcome = outcomeForConnection({
    connection: "close",
    statusCode: 428,
  });
  assert.equal(outcome.action, "retry");
});

test("el reinicio tras el emparejamiento reconecta sin borrar credenciales", () => {
  const outcome = outcomeForConnection({
    connection: "close",
    statusCode: CLOSE_RESTART_REQUIRED,
  });
  assert.equal(outcome.action, "reconnect");
});

test("el logout borra la sesión", () => {
  const outcome = outcomeForConnection({
    connection: "close",
    statusCode: CLOSE_LOGGED_OUT,
  });
  assert.equal(outcome.action, "logout");
});

test("una sesión dañada pide un intento nuevo", () => {
  const outcome = outcomeForConnection({
    connection: "close",
    statusCode: CLOSE_BAD_SESSION,
  });
  assert.equal(outcome.action, "retry-fresh");
});

test("no se pide el historial completo", () => {
  assert.equal(shouldSyncHistory(HISTORY_SYNC_FULL), false);
  assert.equal(shouldSyncHistory(0), true);
  assert.equal(shouldSyncHistory(3), true);
});

test("el jid de whatsapp-web se normaliza al de Baileys", () => {
  assert.equal(toBaileysJid("5215512345678@c.us"), "5215512345678@s.whatsapp.net");
  assert.equal(toBaileysJid("120363@g.us"), "120363@g.us");
  assert.equal(toBaileysJid("123@lid"), "123@lid");
  assert.equal(
    toBaileysJid("5215512345678@s.whatsapp.net"),
    "5215512345678@s.whatsapp.net",
  );
});
