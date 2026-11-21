
module.exports = {
  botName: process.env.BOT_NAME || "TOYINMDBOT",

  prefix: process.env.PREFIX || ".",

  ownerNumber: (process.env.OWNER_NUMBER || "")
    .replace(/\D/g, ""),

  mode: (process.env.BOT_MODE || "public").toLowerCase(),

  port: Number(process.env.PORT || 3000),

  authDir: process.env.AUTH_DIR || "./auth_info",

  menuImage: "public/assets/menu.jpg"
};
