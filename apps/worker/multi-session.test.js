const assert = require("node:assert/strict");
const test = require("node:test");
const { SessionManager, sessionDir, ownPhone } = require("./session-manager");
const { sendClaimedMessage } = require("./cron");

function account(id, slot) {
  return { id, user_id: "same-user", slot, status: "connected" };
}

test("desconectar chats y pendientes solo toca la línea indicada", async () => {
  const operations = [];
  const supabase = {
    from(table) {
      const query = {
        update() { operations.push([table, "update"]); return query; },
        delete() { operations.push([table, "delete"]); return query; },
        eq(column, value) { operations.push(["eq", column, value]); return query; },
        in() { return query; },
        then(resolve) { resolve({ error: null }); },
      };
      return query;
    },
  };
  const manager = new SessionManager(supabase);
  manager.register(account("first", 1));
  manager.register(account("second", 2));
  assert.match(sessionDir("first"), /session-same-user$/);
  assert.match(sessionDir("second"), /session-second$/);
  await manager.clearChats("second");
  assert.deepEqual(operations.filter((item) => item[0] === "eq"), [
    ["eq", "session_id", "second"],
    ["eq", "session_id", "second"],
  ]);
});

test("el número vinculado se normaliza antes de detectar duplicados", () => {
  assert.equal(ownPhone("5211234567890:2@s.whatsapp.net"), "+5211234567890");
  assert.equal(ownPhone("123@lid"), null);
});

test("el cron usa el socket de la línea del mensaje", async () => {
  const sent = [];
  const updates = [];
  const sessions = {
    isReady: () => true,
    getClient(id) {
      return { async sendMessage(jid, body) { sent.push({ id, jid, body }); } };
    },
  };
  const supabase = {
    from() {
      const query = {
        update(row) { updates.push(row); return query; },
        eq() { return query; },
        then(resolve) { resolve({ error: null }); },
      };
      return query;
    },
  };
  await sendClaimedMessage(supabase, sessions, {
    id: "message", user_id: "same-user", session_id: "second",
    wa_id: "5211234567890@c.us", message_body: "hola",
  });
  assert.deepEqual(sent, [{
    id: "second", jid: "5211234567890@s.whatsapp.net", body: { text: "hola" },
  }]);
  assert.equal(updates[0].status, "sent");
});
