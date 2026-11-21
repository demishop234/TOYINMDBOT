
require("dotenv").config();

const express = require("express");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const { registerMessageHandler } = require("./lib/messages");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || "./auth_info";

let sock;
let connecting = false;

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    bot: "TOYINMDBOT",
    connected: Boolean(sock?.user)
  });
});

async function connectBot(phoneNumber) {
  const { state, saveCreds } =
    await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["TOYINMDBOT", "Chrome", "1.0.0"],
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);
  registerMessageHandler(sock);

  if (phoneNumber && !state.creds.registered) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return await sock.requestPairingCode(phoneNumber);
  }

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("TOYINMDBOT connected successfully!");
    }

    if (connection === "close") {
      console.log("WhatsApp connection closed.");
    }
  });

  return null;
}

app.post("/api/pair", async (req, res) => {
  if (connecting) {
    return res.status(429).json({
      error: "Please wait. A connection is already starting."
    });
  }

  const number = String(req.body?.number || "")
    .replace(/\D/g, "");

  if (number.length < 10 || number.length > 15) {
    return res.status(400).json({
      error: "Enter a valid number with country code."
    });
  }

  try {
    connecting = true;

    const code = await connectBot(number);

    if (!code) {
      return res.status(400).json({
        error: "This WhatsApp session is already registered."
      });
    }

    res.json({ code });
  } catch (error) {
    console.error("Pairing error:", error.message);

    res.status(500).json({
      error: "Pairing failed. Please try again."
    });
  } finally {
    connecting = false;
  }
});

app.listen(PORT, () => {
  console.log(`TOYINMDBOT running on port ${PORT}`);
});
