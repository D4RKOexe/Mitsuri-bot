import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import fs from "fs-extra";
import { CONFIG, TEMP_DIR } from "./config.js";
import loadCommands from "./commands/loader.js";
import { reply, grupoPermitido, react } from "./utils.js";
import { getSender } from "./commands/utilidades/permisos.js";
import { checkAntiLink } from "./commands/admin/antilink.js";
import { checkAutoForward } from "./commands/eventos/autoForward.js";
import { setupWelcomeEvent } from "./commands/eventos/welcome.js";
import { setupAutoPromote } from "./commands/eventos/autoPromote.js";
import { registerAntiDelete } from "./plugins/antiDelete.js";
import { checkAntispam } from "./commands/admin/antispam.js";
import { sesiones } from "./sessions.js";
import { descargarApk } from "./commands/descargas/apkdl.js";
import "dotenv/config";
import { iniciarCronBuenasNoches } from "./commands/ia/buenasnoches.js";
import { setupGoodbyeEvent } from "./commands/eventos/goodbye.js";
import iaCmd from "./commands/ia/ia.js";
import { estado } from "./commands/owner/mantenimiento.js";
import { getSesionJuego } from "./commands/juegos/numjuego.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const MSG_STORE_LIMIT = 200;
const OWNER = "573223090406@s.whatsapp.net";

// ─── Comandos que ya manejan sus propias reacciones ───────────────────────────
const SELF_REACT_CMDS = new Set([
  "tt", "tiktok", "ttsearch",
  "fb", "facebook", "fbmp4",
  "ytmp3", "play", "mp3", "song",
  "ytmp4", "video", "yt",
  "spotify", "sp", "spdl",
  "applemusic", "amusic", "apple", "am",
]);

// ─── Init ─────────────────────────────────────────────────────────────────────
await fs.ensureDir(TEMP_DIR);

const commands = await loadCommands();
console.log(`✅ ${Object.keys(commands).length} comandos cargados:`, Object.keys(commands).join(", "));

// ─── Detección de tipo y body del mensaje ─────────────────────────────────────
function getMsgInfo(msg) {
  const m = msg.message;
  if (!m) return { tipo: "vacío", detalle: "", body: "" };

  const body =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    "";

  if (m.documentMessage)     return { tipo: "📄 DOCUMENTO",  detalle: m.documentMessage.fileName || "sin_nombre",            body };
  if (m.conversation)        return { tipo: "texto",          detalle: m.conversation.slice(0, 80),                           body };
  if (m.extendedTextMessage) return { tipo: "textoExtendido", detalle: m.extendedTextMessage.text.slice(0, 80),               body };
  if (m.imageMessage)        return { tipo: "imagen",         detalle: m.imageMessage.caption?.slice(0, 80) || "sin caption", body };
  if (m.videoMessage)        return { tipo: "video",          detalle: m.videoMessage.caption?.slice(0, 80) || "sin caption", body };
  if (m.audioMessage)        return { tipo: "audio",          detalle: "audio",                                               body };
  if (m.stickerMessage)      return { tipo: "sticker",        detalle: "sticker",                                             body };
  if (m.protocolMessage)     return { tipo: "protocol",       detalle: "mensaje sistema",                                     body };

  return { tipo: "desconocido", detalle: "", body };
}

// ─── Bot ──────────────────────────────────────────────────────────────────────
async function startBot() {
  await fs.ensureDir(CONFIG.sessionDir);
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["bytebot", "Safari", "3.0.0"],
    version,
    connectTimeoutMs: 60_000,
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    getMessage: async (key) => {
      if (sock.msgStore?.has(key.id)) {
        return sock.msgStore.get(key.id)?.message || { conversation: "" };
      }
      return { conversation: "" };
    },
  });

  sock.msgStore = new Map();
  sock.ev.on("creds.update", saveCreds);

  // ── Eventos de grupo ──────────────────────────────────────────────────────
  setupAutoPromote(sock);
  setupWelcomeEvent(sock);
  setupGoodbyeEvent(sock);
  iniciarCronBuenasNoches(sock);
  registerAntiDelete(sock);

  // ── Conexión ──────────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📱 Escanea el QR con WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode      = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 428;

      console.log("❌ Conexión cerrada. Status:", statusCode, "| Reconectando:", shouldReconnect);

      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log("🔒 Cerrando permanentemente (conflict o logout)");
        process.exit(0);
      }
    }

    if (connection === "open") {
      console.log(`\n✅ ${CONFIG.botName} conectado!`);
    }
  });

  // ── Mensajes ──────────────────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg?.message) continue;

        let jid = msg.key.remoteJid;

        // Resolver LID → JID real
        if (jid?.endsWith("@lid")) {
          if (msg.key?.senderPn) {
            jid = msg.key.senderPn.includes("@")
              ? msg.key.senderPn
              : `${msg.key.senderPn}@s.whatsapp.net`;
          } else {
            const senderNum = (getSender(msg) || "").split("@")[0];
            if (senderNum) jid = `${senderNum}@s.whatsapp.net`;
          }
        }

        const sender  = getSender(msg);
        const isOwner = sender === OWNER;

        const tempBody =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text || "";

        if (msg.key.fromMe && !tempBody.startsWith(CONFIG.prefix)) continue;

        const isGroup = jid?.endsWith("@g.us");
        const { tipo, detalle, body } = getMsgInfo(msg);
        const stanzaId = msg.key.id;

        // Logger
        console.log("=".repeat(70));
        console.log(`📩 DE: ${sender} | 📱 CHAT: ${jid}`);
        console.log(`🆔 ID: ${stanzaId}`);
        console.log(`📦 TIPO: ${tipo} | 📝 ${detalle}`);
        console.log("=".repeat(70));

        if (!body && !msg.message?.documentMessage) continue;

        // msgStore
        sock.msgStore.set(stanzaId, msg);
        if (sock.msgStore.size > MSG_STORE_LIMIT) {
          sock.msgStore.delete(sock.msgStore.keys().next().value);
        }

        // Auto-forward documentos
        await checkAutoForward(sock, msg);

        // Anti-link
        if (await checkAntiLink(sock, msg, jid, sender, body)) continue;

        // Anti-spam
        if (await checkAntispam(sock, msg, jid, sender)) continue;

        // ─── Control de grupos permitidos ─────────────────────────────────
        if (isGroup && !isOwner && !await grupoPermitido(jid)) continue;

        // ─── Mantenimiento ────────────────────────────────────────────────
        if (estado.mantenimiento && !isOwner) continue;

        // ─── IA por mención en grupos ─────────────────────────────────────
        if (isGroup && body && !body.startsWith(CONFIG.prefix)) {
          const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

          if (menciones.length > 0) {
            try {
              const botNum = sock.user?.id?.split(":")[0];
              const metadata = await sock.groupMetadata(jid);

              const botParticipant = metadata.participants.find(p => {
                const pid = p.id.split("@")[0].split(":")[0];
                const ppn = (p.phoneNumber || "").replace(/\D/g, "");
                return pid === botNum || ppn === botNum;
              });

              const botLid = botParticipant?.id;
              const esMencionado = botLid
                ? menciones.some(m => m === botLid || m.includes(botNum))
                : menciones.some(m => m.includes(botNum));

              if (esMencionado) {
                const textoSinMencion = body.replace(/@\d+/g, "").trim();
                if (textoSinMencion) {
                  await iaCmd.run(sock, msg, textoSinMencion.split(" "), jid, false, false);
                  continue;
                }
              }
            } catch (e) {
              console.error("[IA MENCION ERROR]", e.message);
            }
          }
        }

        // ─── Mensajes sin prefix (sesiones activas) ───────────────────────
        if (!body.startsWith(CONFIG.prefix)) {
          const bodyTrim = body.trim();

          // Juego del número activo
          const sesionJuego = getSesionJuego(jid, sender);
          if (sesionJuego) {
            if (commands["numjuego"]) {
              await commands["numjuego"](sock, msg, [bodyTrim], jid, isOwner, isGroup, sender);
            }
            continue;
          }

          // Sesión apkdl esperando "1" o "2"
          if (sesiones.has(sender) && ["1", "2"].includes(bodyTrim)) {
            console.log("[SESION] Respuesta recibida:", bodyTrim, "de:", sender);
            const sesion = sesiones.get(sender);
            sesiones.delete(sender);
            const prefer = bodyTrim === "1" ? "apk" : "xapk";
            await descargarApk(sock, msg, jid, sesion.query, prefer);
          }

          continue;
        }

        // ─── Comandos ─────────────────────────────────────────────────────
        const [rawCmd, ...args] = body.slice(CONFIG.prefix.length).trim().split(/\s+/);
        if (!rawCmd) continue;

        const cmd = rawCmd.toLowerCase();

        if (commands[cmd]) {
          try {
            if (!SELF_REACT_CMDS.has(cmd)) {
              await react(sock, msg, "⏳");
            }

            await commands[cmd](sock, msg, args, jid, isOwner, isGroup, sender);

            if (!SELF_REACT_CMDS.has(cmd)) {
              await react(sock, msg, "✅");
            }

          } catch (e) {
            console.error(`❌ Error en comando "${cmd}":`, e);
            await react(sock, msg, "❌");
            await reply(sock, jid, `❌ Error en el comando: ${e.message}`, msg);
          }
        }

      } catch (e) {
        console.error("Error en messages.upsert:", e);
      }
    }
  });
}

startBot();