
const { handleCommand } = require("../commands");

const {
  handleAntiDelete,
  handleDeletedMessage
} = require("./antidelete");

const {
  handleProtection
} = require("./protection");

function registerMessageHandler(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        if (msg.message.protocolMessage?.type === 0) {
          await handleDeletedMessage(sock, msg);
          continue;
        }

        await handleAntiDelete(sock, msg);

        const blocked = await handleProtection(sock, msg);
        if (blocked) continue;

        await handleCommand(sock, msg);

      } catch (error) {
        console.error("Message handler error:", error);
      }
    }
  });
}

module.exports = { registerMessageHandler };
