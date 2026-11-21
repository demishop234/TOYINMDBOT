
const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  process.cwd(),
  "data",
  "group-settings.json"
);

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function isAdmin(metadata, jid) {
  const number = jid.split("@")[0].split(":")[0];

  return metadata.participants.some(participant => {
    const participantNumber = participant.id.split("@")[0].split(":")[0];
    return participantNumber === number && !!participant.admin;
  });
}

async function handleProtection(sock, msg) {
  const chat = msg.key.remoteJid;

  if (!chat || !chat.endsWith("@g.us")) return false;

  const settings = loadSettings();

  if (!settings[chat]?.antiLink) return false;

  const message = msg.message || {};
  const text =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    "";

  const inviteLink = /chat\.whatsapp\.com\/[a-zA-Z0-9]+/i.test(text);

  if (!inviteLink) return false;

  const sender = msg.key.participant || "";
  const metadata = await sock.groupMetadata(chat);

  if (isAdmin(metadata, sender)) return false;

  const botNumber = sock.user.id.split(":")[0].split("@")[0];
  const botIsAdmin = isAdmin(metadata, botNumber + "@s.whatsapp.net");

  if (!botIsAdmin) return false;

  await sock.sendMessage(chat, {
    delete: msg.key
  });

  await sock.sendMessage(chat, {
    text: "🚫 WhatsApp group invite links are not allowed. The message has been removed."
  });

  return true;
}

function setAntiLink(chat, enabled) {
  const settings = loadSettings();

  settings[chat] = {
    ...settings[chat],
    antiLink: enabled
  };

  saveSettings(settings);
}

module.exports = {
  handleProtection,
  setAntiLink
};
