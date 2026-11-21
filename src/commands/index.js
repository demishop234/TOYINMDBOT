
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

  const ownerNumber = (process.env.OWNER_NUMBER || "")
    .replace(/\D/g, "");

  const senderNumber = sender.split("@")[0].split(":")[0];

  const isOwner =
    ownerNumber.length > 0 &&
    senderNumber === ownerNumber;

  if (mode === "private" && !isOwner) return;

  const reply = (message) =>
    sock.sendMessage(chat, { text: message }, { quoted: msg });

  const group = chat.endsWith("@g.us");

  const metadata = group
    ? await sock.groupMetadata(chat).catch(() => null)
    : null;

  const participants = metadata?.participants || [];

  const senderAdmin = participants.some(
    p => p.id === sender && p.admin
  );

  const botNumber = sock.user?.id?.split(":")[0];

  const botAdmin = participants.some(
    p => p.id.startsWith(botNumber) && p.admin
  );

  switch (cmd) {

    case "menu":
    case "help":
      return reply(
`╭━━━〔 ${BOT_NAME} 〕
┃
┃ Prefix: ${PREFIX}
┃ Mode: ${mode.toUpperCase()}
┃
┣━━ GENERAL
┃ .menu
┃ .ping
┃ .alive
┃ .owner
┃
┣━━ GROUP
┃ .kick @user
┃ .promote @user
┃ .demote @user
┃ .tagall
┃ .hidetag
┃
┣━━ OWNER
┃ .mode public
┃ .mode private
┃
╰━━━━━━━━━━━━━━`
      );

    case "ping":
      return reply("🏓 Pong! TOYINMDBOT is online.");

    case "alive":
      return reply("✅ TOYINMDBOT is alive and running.");

    case "owner":
      return reply(
        `Bot owner: ${ownerNumber || "Not configured"}`
      );

    case "mode":
      if (!isOwner) {
        return reply("Only the bot owner can change the mode.");
      }

      if (!["public", "private"].includes(args[0])) {
        return reply("Usage: .mode public OR .mode private");
      }

      mode = args[0];

      return reply(`Bot mode changed to ${mode}.`);

    case "tagall":
    case "hidetag":
    case "kick":
    case "promote":
    case "demote": {
      if (!group) {
        return reply("This command only works in groups.");
      }

      if (!senderAdmin && !isOwner) {
        return reply("Only group admins can use this command.");
      }

      if (!botAdmin) {
        return reply("Make TOYINMDBOT a group admin first.");
      }

      if (cmd === "tagall" || cmd === "hidetag") {
        const mentions = participants.map(p => p.id);

        return sock.sendMessage(
          chat,
          {
            text: args.join(" ") || "Attention everyone!",
            mentions
          },
          { quoted: msg }
        );
      }

      const mentions =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!mentions.length) {
        return reply(`Tag a member. Example: ${PREFIX}${cmd} @user`);
      }

      const action = cmd === "kick" ? "remove" : cmd;

      await sock.groupParticipantsUpdate(
        chat,
        mentions,
        action
      );

      return reply(`Successfully executed ${cmd}.`);
    }

    default:
      return reply(
        `Unknown command. Type ${PREFIX}menu to see available commands.`
      );
  }
}

module.exports = { handleCommand };
