const fs = require("fs");
const path = require("path");
const { log } = require("./log");

const CREDS_FILE = "creds.json";

function credsAreRegistered(creds) {
  if (!creds || typeof creds !== "object") return false;
  if (creds.registered === true) return true;
  const id = creds.me && creds.me.id;
  return typeof id === "string" && id.length > 0;
}

function readCredsFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function persistCreds(supabase, sessionId, userId, filePath) {
  const creds = readCredsFile(filePath);
  if (!credsAreRegistered(creds)) return false;
  const { error } = await supabase.from("whatsapp_auth_files").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      name: CREDS_FILE,
      body: JSON.stringify(creds),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,name" },
  );
  if (error) {
    log("perfil", `${userId} no guardó la credencial: ${error.message}`);
    return false;
  }
  log("perfil", `${userId} credencial guardada`);
  return true;
}

async function readStoredCreds(supabase, sessionId) {
  const { data, error } = await supabase
    .from("whatsapp_auth_files")
    .select("body")
    .eq("session_id", sessionId)
    .eq("name", CREDS_FILE)
    .maybeSingle();
  if (error) {
    log("perfil", `${sessionId} no leyó la credencial: ${error.message}`);
    return null;
  }
  if (!data?.body) return null;
  try {
    const creds = JSON.parse(data.body);
    if (!credsAreRegistered(creds)) return null;
  } catch {
    return null;
  }
  return data.body;
}

async function restoreCreds(supabase, sessionId, filePath) {
  const body = await readStoredCreds(supabase, sessionId);
  if (!body) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
  log("perfil", `${sessionId} credencial restaurada`);
  return true;
}

async function deleteCreds(supabase, sessionId) {
  const { error } = await supabase
    .from("whatsapp_auth_files")
    .delete()
    .eq("session_id", sessionId);
  if (error) {
    log("perfil", `${sessionId} no borró la credencial: ${error.message}`);
  }
}

module.exports = {
  CREDS_FILE,
  credsAreRegistered,
  persistCreds,
  readStoredCreds,
  restoreCreds,
  deleteCreds,
};
