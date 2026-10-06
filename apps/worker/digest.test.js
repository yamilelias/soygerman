const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MISSING_CONTEXT,
  composeDigest,
  isOpenUnread,
  promptForChats,
  runDigestForUser,
} = require("./digest");

test("un chat leído, archivado u oculto no entra al resumen", () => {
  assert.equal(
    isOpenUnread({ unread_count: 2, marked_unread: false, archived: false, hidden: false }),
    true,
  );
  assert.equal(
    isOpenUnread({ unread_count: 0, marked_unread: true, archived: false, hidden: false }),
    true,
  );
  assert.equal(
    isOpenUnread({ unread_count: 4, marked_unread: false, archived: true, hidden: false }),
    false,
  );
  assert.equal(
    isOpenUnread({ unread_count: 4, marked_unread: false, archived: false, hidden: true }),
    false,
  );
  assert.equal(
    isOpenUnread({ unread_count: 0, marked_unread: false, archived: false, hidden: false }),
    false,
  );
  assert.equal(
    isOpenUnread({
      unread_count: 3,
      marked_unread: false,
      archived: false,
      hidden: false,
      inbox_visible: false,
    }),
    false,
  );
});

test("el prompt lleva el último texto y no pide el hilo de entrada", () => {
  const prompt = promptForChats(
    [
      {
        wa_id: "521@s.whatsapp.net",
        name: "Ana",
        is_group: false,
        last_message_from_me: false,
        last_message_preview: "¿confirmas la cita?",
      },
    ],
    "2026-10-04",
  );
  assert.match(prompt, /2026-10-04/);
  assert.match(prompt, /521@s.whatsapp.net/);
  assert.match(prompt, /¿confirmas la cita\?/);
  assert.match(prompt, /needs_more_context/);
});

test("pide los últimos mensajes solo cuando el modelo no tiene contexto", async () => {
  const chats = [
    {
      id: "1",
      wa_id: "a@s.whatsapp.net",
      name: "Ana",
      last_message_preview: "ok",
      last_message_from_me: false,
    },
    {
      id: "2",
      wa_id: "b@s.whatsapp.net",
      name: "Beto",
      last_message_preview: "¿y lo de ayer?",
      last_message_from_me: false,
    },
  ];
  const calls = [];
  const fetched = [];
  const result = await composeDigest(chats, {
    date: "2026-10-04",
    async complete(prompt) {
      calls.push(prompt);
      if (calls.length === 1) {
        return {
          overview: "Hay algo con Beto.",
          items: [
            { wa_id: "a@s.whatsapp.net", action: "", needs_more_context: false },
            { wa_id: "b@s.whatsapp.net", action: "", needs_more_context: true },
          ],
        };
      }
      return {
        overview: "Beto dejó algo pendiente.",
        items: [
          {
            wa_id: "b@s.whatsapp.net",
            action: "Responder sobre el tema de ayer",
            needs_more_context: false,
          },
        ],
      };
    },
    async fetchContext(chat) {
      fetched.push(chat.wa_id);
      return ["uno", "dos", "tres", "cuatro", "cinco"];
    },
  });

  assert.deepEqual(fetched, ["b@s.whatsapp.net"]);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /cinco/);
  assert.equal(result.overview, "Beto dejó algo pendiente.");
  assert.deepEqual(result.items, [
    {
      chat_id: "2",
      name: "Beto",
      action: "Responder sobre el tema de ayer",
    },
  ]);
});

test("sin cinco mensajes deja la acción del último texto y no vuelve a llamar al modelo", async () => {
  const calls = [];
  const result = await composeDigest(
    [
      {
        id: "2",
        wa_id: "b@s.whatsapp.net",
        name: "Beto",
        last_message_preview: "¿y lo de ayer?",
        last_message_from_me: false,
      },
    ],
    {
      date: "2026-10-04",
      async complete() {
        calls.push("first");
        return {
          overview: "Falta contexto.",
          items: [
            { wa_id: "b@s.whatsapp.net", action: "", needs_more_context: true },
          ],
        };
      },
      async fetchContext() {
        return ["solo uno"];
      },
    },
  );

  assert.deepEqual(calls, ["first"]);
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].action, /¿y lo de ayer\?/);
  assert.match(result.items[0].action, new RegExp(MISSING_CONTEXT));
});

test("un resumen ya listo no vuelve a llamar al modelo", async () => {
  let calls = 0;
  const ready = {
    status: "ready",
    overview: "Ya está.",
    items: [],
    updated_at: "2026-10-04T12:00:00.000Z",
  };
  const result = await runDigestForUser(
    fakeSupabase({ digest: ready, chats: [] }),
    { isReady: () => true },
    "user-1",
    {
      now: new Date("2026-10-04T13:00:00.000Z"),
      async complete() {
        calls += 1;
        return { overview: "", items: [] };
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.overview, "Ya está.");
});

test("sin chats sin leer no llama al modelo", async () => {
  let calls = 0;
  const saved = [];
  await runDigestForUser(
    fakeSupabase({ digest: null, chats: [], saved }),
    { isReady: () => true },
    "user-1",
    {
      now: new Date("2026-10-04T13:00:00.000Z"),
      async complete() {
        calls += 1;
        return { overview: "", items: [] };
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(saved.at(-1).status, "empty");
});

test("si WhatsApp no está listo el día queda en fallo", async () => {
  let calls = 0;
  const saved = [];
  const result = await runDigestForUser(
    fakeSupabase({ digest: null, chats: [], saved }),
    { isReady: () => false },
    "user-1",
    {
      now: new Date("2026-10-04T13:00:00.000Z"),
      async complete() {
        calls += 1;
        return { overview: "", items: [] };
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.status, "failed");
  assert.match(result.error_message, /no está conectado/);
});

function fakeSupabase({ digest, chats, saved = [] }) {
  return {
    from(table) {
      const state = {
        data: table === "chats" ? chats : digest,
        error: null,
        count: table === "chats" ? chats.length : null,
      };
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        or() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        upsert(payload) {
          saved.push(payload);
          state.data = { ...digest, ...payload };
          return query;
        },
        maybeSingle() {
          return Promise.resolve(state);
        },
        then(onFulfilled, onRejected) {
          return Promise.resolve(state).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  };
}
