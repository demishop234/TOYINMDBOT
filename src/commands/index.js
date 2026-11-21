
const fs = require("fs");
const path = require("path");

const { groupAction } = require("../lib/group");
const { setAntiDelete, getEnabled } = require("../lib/antidelete");
const { setAntiLink } = require("../lib/protection");

const PREFIX = process.env.PREFIX || ".";
const BOT_NAME = "TOYINMDBOT";

let mode = (process.env.BOT_MODE || "public").toLowerCase();

function getText(msg) {
  const m = msg.message || {};

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

function normalizeJid(jid) {
  return (jid || "").split("@")[0].split(":")[0];
}

async function handleCommand(sock, msg) {
  const chat = msg.key.remoteJid;
  const sender = msg.key.participant || chat;
  const text = getText(msg).trim();

  if (!text.startsWith(PREFIX)) return;

  const [command, ...args] = text
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const cmd = (command || "").toLowerCase();

  const owner = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
  const isOwner = !!owner && normalizeJid(sender) === owner;

  if (mode === "private" && !isOwner) return;

  const reply = message =>
    sock.sendMessage(chat, { text: message }, { quoted: msg });

  // MENU
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
┃ .antilink on/off
┣━━ PROTECTION
┃ .antidelete on/off
┣━━ OWNER
┃ .mode public
┃ .mode private
╰━━━━━━━━━━━━━━`;

    const imagePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "menu.jpg"
    );

    if (fs.existsSync(imagePath)) {
      return sock.sendMessage(
        chat,
        {
          image: fs.readFileSync(imagePath),
          caption
        },
        { quoted: msg }
      );
    }

    return reply(caption);
  }

  // GENERAL
  if (cmd === "ping") {
    return reply("🏓 Pong! TOYINMDBOT is online.");
  }

  if (cmd === "alive") {
    return reply("✅ TOYINMDBOT is alive.");
  }

  if (cmd === "owner") {
    return reply(`Bot owner: ${owner || "Not configured"}`);
  }

  // BOT MODE
  if (cmd === "mode") {
    if (!isOwner) {
      return reply("Only the bot owner can change bot mode.");
    }

    const selected = (args[0] || "").toLowerCase();

    if (!["public", "private"].includes(selected)) {
      return reply("Use .mode public or .mode private");
    }

    mode = selected;

    return reply(`✅ Bot mode changed to ${mode}.`);
  }

  // ANTI-DELETE
  if (cmd === "antidelete") {
    if (!isOwner) {
      return reply("Only the bot owner can control Anti-Delete.");
    }

    const selected = (args[0] || "").toLowerCase();

    if (selected === "on") {
      setAntiDelete(true);
      return reply("✅ Anti-Delete enabled.");
    }

    if (selected === "off") {
      setAntiDelete(false);
      return reply("❌ Anti-Delete disabled.");
    }

    return reply(
      `Anti-Delete: ${getEnabled() ? "ON" : "OFF"}\n\n` +
      "Use .antidelete on or .antidelete off"
    );
  }

  // ANTI-LINK
  if (cmd === "antilink") {
    if (!chat.endsWith("@g.us")) {
      return reply("Anti-Link can only be configured in groups.");
    }

    const metadata = await sock.groupMetadata(chat);
    const participant = metadata.participants.find(
      p => normalizeJid(p.id) === normalizeJid(sender)
    );

    if (!isOwner && !participant?.admin) {
      return reply("Only group admins can control Anti-Link.");
    }

    const selected = (args[0] || "").toLowerCase();

    if (selected === "on") {
      setAntiLink(chat, true);
      return reply("✅ Anti-Link enabled for this group.");
    }

    if (selected === "off") {
      setAntiLink(chat, false);
      return reply("❌ Anti-Link disabled for this group.");
    }

    return reply("Use .antilink on or .antilink off");
  }

  // GROUP MANAGEMENT
  if (["kick", "promote", "demote"].includes(cmd)) {
    try {
      const mentions =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      await groupAction(sock, chat, sender, cmd, mentions);

      return reply(`✅ Successfully executed ${cmd}.`);
    } catch (error) {
      return reply(error.message);
    }
  }

  // TAG ALL
  if (cmd === "tagall" || cmd === "hidetag") {
    if (!chat.endsWith("@g.us")) {
      return reply("This command only works in groups.");
    }

    const metadata = await sock.groupMetadata(chat);
    const mentions = metadata.participants.map(p => p.id);

    const message = args.join(" ") || "Attention everyone!";

    return sock.sendMessage(
      chat,
      {
        text: cmd === "tagall"
          ? `📢 ${message}\n\n${mentions.map(jid => "@" + normalizeJid(jid)).join(" ")}`
          : message,
        mentions
      },
      { quoted: msg }
    );
  }

  return reply(`Unknown command. Type ${PREFIX}menu.`);
}

module.exports = { handleCommand };
