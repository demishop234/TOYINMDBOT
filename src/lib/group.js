
async function groupAction(sock, chat, sender, command, mentions) {
  if (!chat.endsWith("@g.us")) {
    throw new Error("This command only works in groups.");
  }

  const metadata = await sock.groupMetadata(chat);
  const participants = metadata.participants;

  const senderAdmin = participants.some(
    p => p.id === sender && p.admin
  );

  const botNumber = sock.user.id.split(":")[0];

  const botAdmin = participants.some(
    p => p.id.startsWith(botNumber) && p.admin
  );

  if (!senderAdmin) {
    throw new Error("Only group admins can use this command.");
  }

  if (!botAdmin) {
    throw new Error("Make TOYINMDBOT a group admin first.");
  }

  if (!mentions.length) {
    throw new Error("Please tag a group member.");
  }

  const action = command === "kick" ? "remove" : command;

  if (!["remove", "promote", "demote"].includes(action)) {
    throw new Error("Invalid group action.");
  }

  return sock.groupParticipantsUpdate(chat, mentions, action);
}

module.exports = { groupAction };
