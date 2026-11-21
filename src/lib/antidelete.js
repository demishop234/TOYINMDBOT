
const fs = require("fs");
const path = require("path");

const deletedMessages = new Map();
const MAX_AGE = 24 * 60 * 60 * 1000;

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
  if (message.audioMessage) return "Voice note / Audio";
  if (message.documentMessage) return "Document";
  if (message.stickerMessage) return "Sticker";
  if (message.conversation || message.extendedTextMessage) return "Text";

  return "Other";
}

async function handleAntiDelete(sock, msg) {
  const key = msg.key;

  if (!key || key.fromMe || !key.remoteJid) return;

  const message = msg.message;
  if (!message) return;

  const cachedMessage = {
    key,
    message,
    timestamp: Date.now()
  };

  deletedMessages.set(key.id, cachedMessage);

  if (deletedMessages.size > 5000) {
    const oldest = deletedMessages.keys().next().value;
    deletedMessages.delete(oldest);
  }
}

async function handleDeletedMessage(sock, msg) {
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
    "🗑️ *ANTI-DELETE ALERT*\n\n" +
    `👤 Sender: ${senderNumber}\n` +
    `📍 Chat: ${chatName}\n` +
    `📦 Type: ${type}\n` +
    `📝 Message: ${text || "No text content"}\n` +
    `🆔 Message ID: ${deletedKey.id}`;

  await sock.sendMessage(ownerJid, { text: caption });
}

module.exports = {
  handleAntiDelete,
  handleDeletedMessage
};
