const cron = require("node-cron");
const { toBaileysJid } = require("./session-manager");
const { runDailyDigests } = require("./digest");

function truncate(message) {
  const text = message || "Error desconocido";
  return text.length > 500 ? text.slice(0, 500) : text;
}

function startCron(supabase, sessions) {
  cron.schedule("* * * * *", async () => {
    if (!sessions.restoreFinished) return;
    const { data, error } = await supabase.rpc("claim_due_messages_v2", {
      batch_limit: 20,
    });

    if (error) {
      console.error("claim_due_messages_v2", error.message);
      return;
    }

    for (const message of data || []) await sendClaimedMessage(supabase, sessions, message);
  });

  cron.schedule(
    "0 6 * * *",
    () => {
      runDailyDigests(supabase, sessions).catch((error) => {
        console.error("resumen", error.message || error);
      });
    },
    { timezone: "America/Mexico_City" },
  );
}

async function sendClaimedMessage(supabase, sessions, message) {
  try {
    if (!sessions.isReady(message.session_id)) {
      const interrupted = await sessions.interrupt(message.session_id);
      throw new Error(interrupted
        ? "La conexión con WhatsApp se interrumpió. Vuelve a vincular."
        : "WhatsApp no está conectado para este usuario");
    }
    const sock = sessions.getClient(message.session_id);
    await sock.sendMessage(toBaileysJid(message.wa_id), { text: message.message_body });
    const { error } = await supabase.from("scheduled_messages")
      .update({ status: "sent", error_message: null })
      .eq("id", message.id).eq("status", "processing");
    if (error) throw new Error(error.message);
    console.log("sent", message.id);
  } catch (sendError) {
    const errorMessage = truncate(sendError.message || String(sendError));
    console.error("failed", message.id, errorMessage);
    await supabase.from("scheduled_messages")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", message.id).eq("status", "processing");
  }
}

module.exports = { startCron, sendClaimedMessage };
