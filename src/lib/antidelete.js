
const fs = require("fs");
const path = require("path");
const {
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const settingsPath = path.join(
  process.cwd(),
  "data",
  "antidelete.json"
);

const deletedMessages = new Map();
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_CACHE = 3000;

function getEnabled() {
  try {
    return JSON.parse(
      fs.readFileSync(settingsPath, "utf8")
    ).enabled === true;
  } catch {
    return false;
  }
}

function setAntiDelete(enabled) {
  fs.mkdirSync(path.dirname(settingsPath), {
    recursive: true
  });

  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ enabled }, null, 2)
  );
}

function getMessageContent(message) {
  let content = message;

  while (content) {
    if (content.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message;
      continue;
    }

    if (content.viewOnceMessage?.message) {
      content = content.viewOnceMessage.message;
      continue;
    }

    if (content.viewOnceMessageV2?.message) {
      content = content.viewOnceMessageV2.message;
      continue;
    }

    break;
  }

  return content || {};
}

function getMessageText(message) {
  const content = getMessageContent(message);

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ""
  );
}

function getMediaType(message) {
  const content = getMessageContent(message);

  if (content.imageMessage) return "image";
  if (content.videoMessage) return "video";
  if (content.audioMessage) return "audio";
  if (content.documentMessage) return "document";
  if (content.stickerMessage) return "sticker";

  return null;
}

function getCacheKey(key) {
  return `${key.remoteJid}:${key.id}`;
}

async function handleAntiDelete(sock, msg) {
  if (!getEnabled()) return;

  const key = msg.key;

  if (
    !key ||
    key.fromMe ||
    !key.remoteJid ||
    !key.id ||
    !msg.message
  ) {
    return;
  }

  deletedMessages.set(getCacheKey(key), {
    key,
    message: msg,
    timestamp: Date.now()
  });

  if (deletedMessages.size > MAX_CACHE) {
    const oldest = deletedMessages.keys().next().value;
    deletedMessages.delete(oldest);
  }
}

async function handleDeletedMessage(sock, msg) {
  if (!getEnabled()) return;

  const protocol = msg.message?.protocolMessage;

  if (!protocol || protocol.type !== 0) return;

  const deletedKey = protocol.key;

  if (!deletedKey?.id || !deletedKey.remoteJid) return;

  const cacheKey = getCacheKey(deletedKey);
  const cached = deletedMessages.get(cacheKey);

  if (!cached) return;

  deletedMessages.delete(cacheKey);

  if (Date.now() - cached.timestamp > MAX_AGE) return;

  const owner = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");

  if (!owner) {
    console.error("Anti-Delete: OWNER_NUMBER is not configured.");
    return;
  }

  const ownerJid = `${owner}@s.whatsapp.net`;
  const chat = cached.key.remoteJid;
  const sender = cached.key.participant || chat;
  const senderNumber = sender.split("@")[0].split(":")[0];

  let chatName = chat;

  if (chat.endsWith("@g.us")) {
    try {
      const metadata = await sock.groupMetadata(chat);
      chatName = metadata.subject;
    } catch {}
  }

  const content = getMessageContent(cached.message.message);
  const text = getMessageText(cached.message.message);
  const mediaType = getMediaType(cached.message.message);

  const details =
    "🗑️ *ANTI-DELETE ALERT*\n\n" +
    `👤 Sender: ${senderNumber}\n` +
    `📍 Chat: ${chatName}\n` +
    `📦 Type: ${mediaType || "Text / Other"}\n` +
    `📝 Message: ${text || "No text content"}\n` +
    `🆔 Message ID: ${deletedKey.id}`;

  await sock.sendMessage(ownerJid, {
    text: details
  });

  if (!mediaType) return;

  try {
    const buffer = await downloadMediaMessage(
      cached.message,
      "buffer",
      {},
      {
        logger: console,
        reuploadRequest: sock.updateMediaMessage
      }
    );

    if (!buffer) return;

    const media = content[
      `${mediaType}Message`
    ];

    const caption =
      `Recovered deleted ${mediaType} from ${senderNumber}`;

    if (mediaType === "image") {
      await sock.sendMessage(ownerJid, {
        image: buffer,
        caption: media.caption || caption
      });
    } else if (mediaType === "video") {
      await sock.sendMessage(ownerJid, {
        video: buffer,
        caption: media.caption || caption
      });
    } else if (mediaType === "audio") {
      await sock.sendMessage(ownerJid, {
        audio: buffer,
        mimetype: media.mimetype || "audio/mpeg",
        ptt: media.ptt || false
      });
    } else if (mediaType === "document") {
      await sock.sendMessage(ownerJid, {
        document: buffer,
        mimetype: media.mimetype || "application/octet-stream",
        fileName: media.fileName || "recovered-file"
      });
    } else if (mediaType === "sticker") {
      await sock.sendMessage(ownerJid, {
        sticker: buffer
      });
    }
  } catch (error) {
    console.error("Anti-Delete media recovery failed:", error);

    await sock.sendMessage(ownerJid, {
      text: "⚠️ The deleted message was detected, but its media could not be recovered."
    });
  }
}

module.exports = {
  handleAntiDelete,
  handleDeletedMessage,
  setAntiDelete,
  getEnabled
};
