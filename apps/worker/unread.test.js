const assert = require("node:assert/strict");
const test = require("node:test");
const {
  absorbChat,
  absorbMessage,
  applyReadSnapshot,
  clearRepliedChats,
  cursorFromConditional,
  groupChatRows,
} = require("./unread");

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
  assert.deepEqual(detailed[0].last_message_key, {
    id: "m",
    fromMe: false,
    participant: null,
  });
  assert.equal(detailed[0].unread_since, "2023-11-14T22:13:20.000Z");
  assert.equal("unread_count" in plain[0], false);
  assert.equal("last_message_preview" in plain[0], false);
  assert.equal("last_message_key" in plain[0], false);
  assert.equal("archived" in detailed[0], false);
});

test("un chat archivado se guarda como archivado y un aviso posterior no lo desarma", () => {
  const archived = absorbChat(
    null,
    {
      id: "521@s.whatsapp.net",
      name: "Ana",
      unreadCount: 2,
      archived: true,
    },
    false,
  );
  assert.equal(archived.state.archived, true);
  const later = absorbChat(
    archived.state,
    { id: "521@s.whatsapp.net", unreadCount: 3 },
    false,
  );
  assert.equal(later.state.archived, true);
  const rows = groupChatRows("user", [later.state], "2026-10-04T00:00:00.000Z");
  assert.equal(rows[0][0].archived, true);
  assert.equal(rows[0][0].unread_count, 3);

  const opened = absorbChat(
    later.state,
    { id: "521@s.whatsapp.net", archived: false },
    false,
  );
  assert.equal(opened.state.archived, false);
  const unarchived = groupChatRows(
    "user",
    [opened.state],
    "2026-10-04T00:00:00.000Z",
  );
  assert.equal(unarchived[0][0].archived, false);
});

test("marcar como leído deja el conteo en cero", () => {
  const opened = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 2 },
    false,
  );
  const read = absorbChat(
    opened.state,
    { id: "521@s.whatsapp.net", unreadCount: 0 },
    false,
  );
  assert.equal(read.state.unreadCount, 0);
  assert.equal(read.state.markedUnread, false);
  assert.equal(read.state.unreadSince, null);
});

test("marcar como no leído no se confunde con cero", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: -1 },
    false,
  );
  assert.equal(state.markedUnread, true);
  assert.equal(state.unreadCount, 0);
});

test("responder en vivo marca la conversación como leída", () => {
  const opened = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 2, markedAsUnread: true },
    false,
  );
  absorbMessage(
    opened.state,
    {
      key: { fromMe: true, id: "reply" },
      messageTimestamp: 1_700_000_900,
      message: { conversation: "ya quedó" },
    },
    { live: true },
  );
  assert.equal(opened.state.unreadCount, 0);
  assert.equal(opened.state.markedUnread, false);
  assert.equal(opened.state.lastMessagePreview, "ya quedó");
});

test("una marca de leído no tapa un mensaje más nuevo", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 1 },
    false,
  );
  absorbMessage(state, {
    key: { fromMe: false, id: "new" },
    messageTimestamp: 1_700_000_500,
    status: 2,
    message: { conversation: "¿sigues?" },
  });
  const kept = applyReadSnapshot(state, { unreadCount: null, cursorSeconds: 1_700_000_100 });
  assert.equal(kept, false);
  assert.equal(state.unreadCount, 1);

  const cleared = applyReadSnapshot(state, {
    unreadCount: null,
    cursorSeconds: 1_700_000_500,
  });
  assert.equal(cleared, true);
  assert.equal(state.unreadCount, 0);
  assert.equal(state.markedUnread, false);
});

test("el cursor sale del rango que WhatsApp manda al marcar leído", () => {
  const id = "521@s.whatsapp.net";
  const cursor = 1_700_000_400;
  const conditional = (data) => {
    const chat = data.historySets.chats[id];
    if (!chat) return;
    return cursor >= Number(chat.lastMessageRecvTimestamp || 0);
  };
  assert.equal(cursorFromConditional(conditional, id), cursor);
  const unconditional = () => true;
  assert.equal(cursorFromConditional(unconditional, id), null);
});

test("una respuesta ya guardada deja de contarse como no leída", () => {
  const { state } = absorbChat(
    null,
    { id: "521@s.whatsapp.net", name: "Ana", unreadCount: 2 },
    false,
  );
  state.lastMessageFromMe = true;
  const chats = new Map([[state.waId, state]]);
  assert.equal(clearRepliedChats(chats), 1);
  assert.equal(state.unreadCount, 0);
});
