
const { handleCommand } = require("../commands");
const {
  handleAntiDelete,
  handleDeletedMessage
} = require("./antidelete");

function registerMessageHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (msg.message?.protocolMessage?.type === 0) {
          await handleDeletedMessage(sock, msg);
          continue;
        }

        if (!msg.message) continue;

        await handleAntiDelete(sock, msg);
        await handleCommand(sock, msg);
      } catch (error) {
        console.error("Message handler error:", error);
      }
    }
  });
}

module.exports = { registerMessageHandler };
