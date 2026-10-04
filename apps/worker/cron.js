const cron = require("node-cron");
const { toBaileysJid } = require("./session-manager");
const { runDailyDigests } = require("./digest");

function truncate(message) {
  const text = message || "Error desconocido";
  return text.length > 500 ? text.slice(0, 500) : text;
}

function startCron(supabase, sessions) {
  cron.schedule("* * * * *", async () => {
    const { data, error } = await supabase.rpc("claim_due_messages", {
      batch_limit: 20,
    });

    if (error) {
      console.error("claim_due_messages", error.message);
      return;
    }

    for (const message of data || []) {
      try {
        if (!sessions.isReady(message.user_id)) {
          const interrupted = await sessions.interrupt(message.user_id);
          throw new Error(
            interrupted
              ? "La conexión con WhatsApp se interrumpió. Vuelve a vincular."
              : "WhatsApp no está conectado para este usuario",
          );
        }
        const sock = sessions.getClient(message.user_id);
        await sock.sendMessage(toBaileysJid(message.wa_id), {
          text: message.message_body,
        });
        const { error: updateError } = await supabase
          .from("scheduled_messages")
          .update({ status: "sent", error_message: null })
          .eq("id", message.id)
          .eq("status", "processing");
        if (updateError) throw new Error(updateError.message);
        console.log("sent", message.id);
      } catch (sendError) {
        const errorMessage = truncate(sendError.message || String(sendError));
        console.error("failed", message.id, errorMessage);
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", message.id)
          .eq("status", "processing");
      }
    }
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

module.exports = { startCron };
