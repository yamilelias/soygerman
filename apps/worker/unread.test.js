const assert = require("node:assert/strict");
const test = require("node:test");
const { absorbChat, absorbMessage, groupChatRows } = require("./unread");

test("un chat sin datos de lectura no borra el no leído que ya teníamos", () => {
  const first = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 2, markedAsUnread: false },
    false,
  );
  const second = absorbChat(
    first.state,
    { id: "521@s.whatsapp.net", name: "Ana Gómez" },
    false,
  );
  assert.equal(second.state.unreadCount, 2);
  assert.equal(second.state.name, "Ana Gómez");
  assert.equal(second.changed, true);
});

test("al quedar leído se olvida desde cuándo", () => {
  const opened = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 1 },
    false,
  );
  absorbMessage(
    opened.state,
    {
      key: { remoteJid: "521@s.whatsapp.net", fromMe: false, id: "a" },
      messageTimestamp: 1_700_000_000,
      status: 2,
      message: { conversation: "¿sigues en la junta?" },
    },
    { notify: false },
  );
  assert.equal(opened.state.unreadSince, 1_700_000_000);
  const read = absorbChat(
    opened.state,
    { id: "521@s.whatsapp.net", unreadCount: 0, markedAsUnread: false },
    false,
  );
  assert.equal(read.state.unreadSince, null);
  assert.equal(read.state.unreadCount, 0);
});

test("el desde es el mensaje entrante sin leer más viejo", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 2 },
    false,
  );
  absorbMessage(state, {
    key: { fromMe: false, id: "new" },
    messageTimestamp: 1_700_000_200,
    status: 3,
    message: { conversation: "el segundo" },
  });
  absorbMessage(state, {
    key: { fromMe: false, id: "old" },
    messageTimestamp: 1_700_000_100,
    status: 2,
    message: { conversation: "el primero" },
  });
  absorbMessage(state, {
    key: { fromMe: false, id: "seen" },
    messageTimestamp: 1_700_000_000,
    status: 4,
    message: { conversation: "ya lo leí" },
  });
  absorbMessage(state, {
    key: { fromMe: true, id: "mine" },
    messageTimestamp: 1_700_000_300,
    status: 2,
    message: { conversation: "voy" },
  });
  assert.equal(state.unreadSince, 1_700_000_100);
  assert.equal(state.lastMessagePreview, "voy");
  assert.equal(state.lastMessageFromMe, true);
});

test("marcada como no leída no inventa una fecha", () => {
  const { state } = absorbChat(
    null,
    {
      id: "521@s.whatsapp.net",
      name: "Ana",
      unreadCount: 0,
      markedAsUnread: true,
    },
    false,
  );
  absorbMessage(state, {
    key: { fromMe: false, id: "seen" },
    messageTimestamp: 1_700_000_000,
    status: 4,
    message: { conversation: "listo" },
  });
  assert.equal(state.markedUnread, true);
  assert.equal(state.unreadSince, null);
  assert.equal(state.lastMessagePreview, "listo");
});

test("un solo no leído usa la hora del último mensaje entrante", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 1 },
    false,
  );
  absorbMessage(state, {
    key: { fromMe: false, id: "only" },
    messageTimestamp: 1_700_000_500,
    message: { ephemeralMessage: { message: { conversation: "oculto" } } },
  });
  assert.equal(state.unreadSince, 1_700_000_500);
  assert.equal(state.lastMessagePreview, "oculto");
});

test("una reacción no tapa el último texto", () => {
  const { state } = absorbChat(
    null,
    { id: "g@g.us", name: "Equipo", unreadCount: 1 },
    true,
  );
  absorbMessage(state, {
    key: { fromMe: false, id: "text" },
    messageTimestamp: 1_700_000_000,
    status: 2,
    pushName: "Luis",
    message: { conversation: "mañana a las 9" },
  });
  absorbMessage(state, {
    key: { fromMe: false, id: "react" },
    messageTimestamp: 1_700_000_050,
    status: 2,
    message: { reactionMessage: { text: "👍" } },
  });
  assert.equal(state.lastMessagePreview, "Luis: mañana a las 9");
});

test("un aviso en vivo abre el chat si estaba en cero", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 0 },
    false,
  );
  absorbMessage(
    state,
    {
      key: { fromMe: false, id: "live" },
      messageTimestamp: 1_700_000_800,
      message: { extendedTextMessage: { text: "¿puedes hoy?" } },
    },
    { notify: true },
  );
  assert.equal(state.unreadCount, 1);
  assert.equal(state.unreadSince, 1_700_000_800);
  assert.equal(state.lastMessagePreview, "¿puedes hoy?");
});

test("el guardado no pisa columnas que este chat no trajo", () => {
  const known = absorbChat(
    null,
    { id: "a@s.whatsapp.net", name: "Ana", unreadCount: 1, markedAsUnread: false },
    false,
  ).state;
  absorbMessage(known, {
    key: { fromMe: false, id: "m" },
    messageTimestamp: 1_700_000_000,
    status: 2,
    message: { conversation: "hola" },
  });
  const namedOnly = absorbChat(
    null,
    { id: "b@s.whatsapp.net", name: "Beto" },
    false,
  ).state;
  const groups = groupChatRows("user", [known, namedOnly], "2026-10-04T00:00:00.000Z");
  assert.equal(groups.length, 2);
  const detailed = groups.find((rows) => rows[0].wa_id.startsWith("a@"));
  const plain = groups.find((rows) => rows[0].wa_id.startsWith("b@"));
  assert.equal(detailed[0].unread_count, 1);
  assert.equal(detailed[0].last_message_preview, "hola");
  assert.equal(detailed[0].unread_since, "2023-11-14T22:13:20.000Z");
  assert.equal("unread_count" in plain[0], false);
  assert.equal("last_message_preview" in plain[0], false);
});
