
const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  process.cwd(),
  "data",
  "antidelete.json"
);

const deletedMessages = new Map();
const MAX_AGE = 24 * 60 * 60 * 1000;

function getEnabled() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8")).enabled === true;
  } catch {
    return false;
  }
}

function setAntiDelete(enabled) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ enabled }, null, 2)
  );
}

function getMessageText(message) {
  if (!message) return "";

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ""
  );
}

function getMessageType(message) {
  if (!message) return "Unknown";
  if (message.imageMessage) return "Photo";
  if (message.videoMessage) return "Video";
  if (message.audioMessage) return "Audio";
  if (message.documentMessage) return "Document";
  if (message.stickerMessage) return "Sticker";
  if (message.conversation || message.extendedTextMessage) return "Text";

  return "Other";
}

async function handleAntiDelete(sock, msg) {
  if (!getEnabled()) return;

  const key = msg.key;
  if (!key || key.fromMe || !key.remoteJid || !msg.message) return;

  deletedMessages.set(key.id, {
    key,
    message: msg.message,
    timestamp: Date.now()
  });

  if (deletedMessages.size > 5000) {
    const oldest = deletedMessages.keys().next().value;
    deletedMessages.delete(oldest);
  }
}

async function handleDeletedMessage(sock, msg) {
  if (!getEnabled()) return;

  const protocol = msg.message?.protocolMessage;
  if (!protocol || protocol.type !== 0) return;

  const deletedKey = protocol.key;
  if (!deletedKey?.id) return;

  const cached = deletedMessages.get(deletedKey.id);
  if (!cached) return;

  deletedMessages.delete(deletedKey.id);

  if (Date.now() - cached.timestamp > MAX_AGE) return;

  const owner = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
  if (!owner) return;

  const ownerJid = owner + "@s.whatsapp.net";
  const chat = cached.key.remoteJid;
  const sender = cached.key.participant || chat;

  let chatName = chat;

  if (chat.endsWith("@g.us")) {
    try {
      const metadata = await sock.groupMetadata(chat);
      chatName = metadata.subject;
    } catch {}
  }

  const senderNumber = sender.split("@")[0].split(":")[0];
  const text = getMessageText(cached.message);
  const type = getMessageType(cached.message);

  const caption =
    "🗑️ ANTI-DELETE ALERT\n\n" +
    `👤 Sender: ${senderNumber}\n` +
    `📍 Chat: ${chatName}\n` +
    `📦 Type: ${type}\n` +
    `📝 Message: ${text || "No text content"}\n` +
    `🆔 Message ID: ${deletedKey.id}`;

  await sock.sendMessage(ownerJid, { text: caption });
}

module.exports = {
  handleAntiDelete,
  handleDeletedMessage,
  setAntiDelete,
  getEnabled
};
