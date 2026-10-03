const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { credsAreRegistered, restoreCreds, persistCreds } = require("./auth-store");

test("se reabre con registered o con me.id", () => {
  assert.equal(credsAreRegistered({ registered: true }), true);
  assert.equal(
    credsAreRegistered({ registered: false, me: { id: "521@s.whatsapp.net" } }),
    true,
  );
  assert.equal(credsAreRegistered({ registered: false }), false);
  assert.equal(credsAreRegistered({ me: { id: "" } }), false);
  assert.equal(credsAreRegistered(null), false);
});

test("la credencial registrada se guarda y se vuelve a escribir en disco", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-auth-"));
  const filePath = path.join(dir, "creds.json");
  const creds = { registered: true, noiseKey: { public: "abc" } };
  fs.writeFileSync(filePath, JSON.stringify(creds));

  const rows = new Map();
  const supabase = {
    from() {
      return {
        upsert(row) {
          rows.set(row.name, row.body);
          return { error: null };
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          return { data: { body: rows.get("creds.json") }, error: null };
        },
      };
    },
  };

  assert.equal(await persistCreds(supabase, "user", filePath), true);
  fs.rmSync(filePath);
  const restored = path.join(dir, "nested", "creds.json");
  assert.equal(await restoreCreds(supabase, "user", restored), true);
  assert.equal(credsAreRegistered(JSON.parse(fs.readFileSync(restored, "utf8"))), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Baileys 7 guarda la credencial aunque registered siga en false", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-auth-"));
  const filePath = path.join(dir, "creds.json");
  const creds = { registered: false, me: { id: "521@s.whatsapp.net" }, noiseKey: {} };
  fs.writeFileSync(filePath, JSON.stringify(creds));
  let body = null;
  const supabase = {
    from() {
      return {
        upsert(row) {
          body = row.body;
          return { error: null };
        },
      };
    },
  };
  assert.equal(await persistCreds(supabase, "user", filePath), true);
  assert.equal(JSON.parse(body).me.id, "521@s.whatsapp.net");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("una credencial a medias no se copia a la base", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-auth-"));
  const filePath = path.join(dir, "creds.json");
  fs.writeFileSync(filePath, JSON.stringify({ registered: false }));
  let wrote = false;
  const supabase = {
    from() {
      return {
        upsert() {
          wrote = true;
          return { error: null };
        },
      };
    },
  };
  assert.equal(await persistCreds(supabase, "user", filePath), false);
  assert.equal(wrote, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
