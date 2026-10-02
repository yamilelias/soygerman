const assert = require("node:assert/strict");
const test = require("node:test");
const { linkStatusForEntry } = require("./session-manager");

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
