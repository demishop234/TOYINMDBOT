
const { handleCommand } = require("../commands");

function registerMessageHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      try {
        await handleCommand(sock, msg);
      } catch (error) {
        console.error("Message error:", error.message);
      }
    }
  });
}

module.exports = { registerMessageHandler };
