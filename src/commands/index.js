
const fs = require("fs");
const path = require("path");
const { groupAction } = require("../lib/group");

const PREFIX = process.env.PREFIX || ".";
const BOT_NAME = "TOYINMDBOT";

let mode = (process.env.BOT_MODE || "public").toLowerCase();

function getText(msg) {
  const m = msg.message || {};
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption || "";
}

async function handleCommand(sock, msg) {
  const chat = msg.key.remoteJid;
  const sender = msg.key.participant || chat;
  const text = getText(msg).trim();

  if (!text.startsWith(PREFIX)) return;

  const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (command || "").toLowerCase();

  const owner = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
  const senderNumber = sender.split("@")[0].split(":")[0];
  const isOwner = !!owner && senderNumber === owner;

  if (mode === "private" && !isOwner) return;

  const reply = message =>
    sock.sendMessage(chat, { text: message }, { quoted: msg });

  if (["menu", "help"].includes(cmd)) {
    const caption = `╭━━━〔 ${BOT_NAME} 〕
┃ Prefix: ${PREFIX}
┃ Mode: ${mode.toUpperCase()}
┣━━ GENERAL
┃ .menu
┃ .ping
┃ .alive
┃ .owner
┣━━ GROUP
┃ .kick @user
┃ .promote @user
┃ .demote @user
┃ .tagall
┃ .hidetag
┣━━ OWNER
┃ .mode public
┃ .mode private
╰━━━━━━━━━━━━━━`;

    const imagePath = path.join(process.cwd(), "public", "assets", "menu.jpg");

    if (fs.existsSync(imagePath)) {
      return sock.sendMessage(chat, {
        image: fs.readFileSync(imagePath),
        caption
      }, { quoted: msg });
    }

    return reply(caption);
  }

  if (cmd === "ping") return reply("🏓 Pong! TOYINMDBOT is online.");
  if (cmd === "alive") return reply("✅ TOYINMDBOT is alive.");
  if (cmd === "owner") return reply(`Bot owner: ${owner || "Not configured"}`);

  if (cmd === "mode") {
    if (!isOwner) return reply("Only the owner can change bot mode.");

    const selected = (args[0] || "").toLowerCase();
    if (!["public", "private"].includes(selected)) {
      return reply("Use .mode public or .mode private");
    }

    mode = selected;
    return reply(`Bot mode changed to ${mode}.`);
  }

  if (["kick", "promote", "demote"].includes(cmd)) {
    try {
      const mentions =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      await groupAction(sock, chat, sender, cmd, mentions);
      return reply(`Successfully executed ${cmd}.`);
    } catch (error) {
      return reply(error.message);
    }
  }

  if (["tagall", "hidetag"].includes(cmd)) {
    if (!chat.endsWith("@g.us")) return reply("Group command only.");

    const metadata = await sock.groupMetadata(chat);
    const mentions = metadata.participants.map(p => p.id);

    return sock.sendMessage(chat, {
      text: args.join(" ") || "Attention everyone!",
      mentions
    }, { quoted: msg });
  }

  return reply(`Unknown command. Type ${PREFIX}menu.`);
}

module.exports = { handleCommand };
