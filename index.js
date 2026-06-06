import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs-extra";
import readline from "readline";
import { CONFIG, TEMP_DIR } from "./config.js";
import loadCommands from "./commands/loader.js";
import { reply, grupoPermitido, react } from "./utils.js";
import { getSender } from "./commands/utilidades/permisos.js";
import { checkAntiLink } from "./commands/admin/antilink.js";
import { checkAutoForward } from "./commands/eventos/AutoForward.js";
import { setupWelcomeEvent } from "./commands/eventos/Welcome.js";
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
import { loadDB, saveDB, getUser, saveNombre, numId } from "./commands/economia/db.js";

// ─── Constantes ───────────────────────────────────────────────────────────────
const MSG_STORE_LIMIT = 1000;
const OWNER = "573223090406@s.whatsapp.net";
const SESSION_FILE = "./session_phone.json";

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

// ─── Pedir número ─────────────────────────────────────────────────────────────
function askQuestion(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function getPhoneNumber() {
  if (await fs.pathExists(SESSION_FILE)) {
    try {
      const data = JSON.parse(await fs.readFile(SESSION_FILE, "utf8"));
      if (data.phone) return data.phone;
    } catch {}
  }

  console.log("\n╔════════════════════════════════════════╗");
  console.log("   🤖  BOT — Configuración inicial         ");
  console.log("╚════════════════════════════════════════╝\n");
  console.log("  Solo necesitas hacer esto UNA VEZ.\n");

  let number = "";
  while (!number || !/^\d{10,15}$/.test(number)) {
    number = await askQuestion("  📱 Tu número (con código de país, sin +):\n  Ej: 573XXXXXXXXX → ");
    if (!/^\d{10,15}$/.test(number)) {
      console.log("  ❌ Número inválido, intenta de nuevo.\n");
    }
  }

  await fs.writeFile(SESSION_FILE, JSON.stringify({ phone: number }, null, 2));
  console.log(`\n  ✅ Número guardado: ${number}\n`);
  return number;
}

// ─── Borrar sesión ────────────────────────────────────────────────────────────
async function clearSession() {
  try {
    if (await fs.pathExists(CONFIG.sessionDir)) {
      await fs.remove(CONFIG.sessionDir);
      console.log("🗑️  Sesión borrada automáticamente.");
    }
    // ✅ FIX: Recrear la carpeta de inmediato para evitar ENOENT en saveCreds
    await fs.ensureDir(CONFIG.sessionDir);
  } catch (e) {
    console.error("No se pudo borrar la sesión:", e.message);
  }
}

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
let sessionRetries = 0;
const MAX_SESSION_RETRIES = 3;
const mensajesProcesados = new Set();

async function startBot() {
  const PHONE_NUMBER = await getPhoneNumber();

  await fs.ensureDir(CONFIG.sessionDir);

  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir));
  } catch (e) {
    console.error("❌ Sesión corrupta:", e.message);
    if (sessionRetries < MAX_SESSION_RETRIES) {
      sessionRetries++;
      console.log(`⚠️  Auto-reparando... (${sessionRetries}/${MAX_SESSION_RETRIES})`);
      await clearSession();
      setTimeout(startBot, 2000);
    } else {
      console.error("❌ No se pudo reparar. Borra la carpeta de sesión manualmente.");
    }
    return;
  }

  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: "silent" });
  logger.child = () => logger;

  const sock = makeWASocket({
    version,
    browser: Browsers.ubuntu("Chrome"),
    logger,
    auth: state,
    printQRInTerminal: false,
    getMessage: async (key) => {
      if (sock.msgStore?.has(key.id)) {
        return sock.msgStore.get(key.id)?.message || { conversation: "" };
      }
      return { conversation: "" };
    },
  });
    // ← agrega esto
  const _send = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options) => {
    const texto = content?.text || content?.caption || "";
    if (
      typeof texto === "string" &&
      !texto.trim() &&
      !content?.image &&
      !content?.video &&
      !content?.audio &&
      !content?.sticker &&
      !content?.document &&
      !content?.react
    ) return;
    return _send(jid, content, options);
  };

  sock.msgStore = new Map();


  // ✅ Guardar credenciales al instante (sin debounce) — así al reconectar
  // ya existe creds.json y no vuelve a pedir código de vinculación
  sock.ev.on("creds.update", saveCreds);

  // ── Pedir código solo si NO hay sesión guardada en disco ─────────────────
  const credsPath = `${CONFIG.sessionDir}/creds.json`;
  const yaHayCreds = await fs.pathExists(credsPath);

  if (!state.creds.registered && !yaHayCreds) {
    console.log(`\n⏳ Solicitando código para: ${PHONE_NUMBER}`);
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log("\n╔══════════════════════════════════════╗");
      console.log(`   🔑 CÓDIGO DE VINCULACIÓN: ${code}   `);
      console.log("╚══════════════════════════════════════╝");
      console.log("\n  WhatsApp > Dispositivos vinculados");
      console.log("  > Vincular con número de teléfono\n");
    } catch (e) {
      console.error("❌ Error al pedir código:", e.message);
      console.log("⚠️  Reinicia el bot e intenta de nuevo.");
    }
  } else if (!state.creds.registered && yaHayCreds) {
    console.log("🔄 Sesión en disco encontrada, reconectando sin pedir código...");
  }

  // ── Eventos de grupo ──────────────────────────────────────────────────────
  setupAutoPromote(sock);
  setupWelcomeEvent(sock);
  setupGoodbyeEvent(sock);
  iniciarCronBuenasNoches(sock);

  // ── Conexión ──────────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      sessionRetries = 0;
      console.log(`\n✅ ${CONFIG.botName} conectado!`);
      registerAntiDelete(sock);
      return;
    }

    if (connection === "close") {
      const statusCode   = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut  = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isConflict   = statusCode === DisconnectReason.connectionReplaced;

      console.log("❌ Conexión cerrada. Status:", statusCode);

      if (isLoggedOut) {
        // Solo borrar sesión si WhatsApp explícitamente cerró la cuenta (desvinculación manual)
        console.log("🗑️  Sesión cerrada por WhatsApp. Eliminando y reiniciando...");
        await clearSession();
        if (sessionRetries < MAX_SESSION_RETRIES) {
          sessionRetries++;
          setTimeout(startBot, 3000);
        } else {
          console.error("❌ Demasiados intentos fallidos. Reinicia manualmente.");
        }
      } else if (isBadSession) {
        // badSession: reconectar sin borrar, puede recuperarse solo
        console.log("⚠️  Bad session, reconectando sin borrar sesión...");
        setTimeout(startBot, 3000);
      } else if (isConflict) {
        console.log("⚠️  Bot abierto en otro lugar. Cerrando esta instancia.");
        process.exit(0);
      } else {
        console.log("🔄 Reconectando en 3s...");
        setTimeout(startBot, 3000);
      }
    }
  });

  // ── Mensajes ──────────────────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      const stanzaId = msg?.key?.id;

      // Detección de duplicados
      if (mensajesProcesados.has(stanzaId)) continue;

      try {
        if (!msg?.message) continue;

        mensajesProcesados.add(stanzaId);
        setTimeout(() => mensajesProcesados.delete(stanzaId), 60000);

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
        if (estado.mantenimiento && !isOwner) {
          await reply(sock, jid,
           `🔧 *El bot está en mantenimiento*\n\n` +
           `⚠️ No está disponible por el momento.\n` +
           `Intenta más tarde.`,
           msg
         );
         continue;
       }

// ─── IA por mención o respuesta al bot en grupos ──────────────────
        if (isGroup && body && !body.startsWith(CONFIG.prefix)) {
          const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
          const participantQuoted = contextInfo?.participant || "";
          const botNum = sock.user?.id?.split(":")[0];

          let activarIA = false;

          try {
            const metadata = await sock.groupMetadata(jid);

            const botParticipant = metadata.participants.find(p => {
              const pid = p.id.split("@")[0].split(":")[0];
              const ppn = (p.phoneNumber || "").replace(/\D/g, "");
              return pid === botNum || ppn === botNum;
            });

            const botLid = botParticipant?.id || "";

            const esMencionado = botLid
              ? menciones.some(m => m === botLid || m.includes(botNum))
              : menciones.some(m => m.includes(botNum));

            const esRespuesta = participantQuoted &&
              (participantQuoted.includes(botNum) || participantQuoted === botLid);

            activarIA = esMencionado || esRespuesta;

          } catch (e) {
            const esMencionado = menciones.some(m => m.includes(botNum));
            const esRespuesta  = participantQuoted.includes(botNum);
            activarIA = esMencionado || esRespuesta;
            console.error("[IA GRUPO ERROR]", e.message);
          }

          if (activarIA) {
            const textoLimpio = body.replace(/@\d+/g, "").trim();
            if (textoLimpio) {
              await iaCmd.run(sock, msg, textoLimpio.split(" "), jid, false, false);
              continue;
            }
          }
        }
        // ─── Mensajes sin prefix (sesiones activas) ───────────────────────
        if (!body.startsWith(CONFIG.prefix)) {
          const bodyTrim = body.trim();

          const sesionJuego = getSesionJuego(jid, sender);
          if (sesionJuego) {
            if (commands["numjuego"]) {
              await commands["numjuego"](sock, msg, [bodyTrim], jid, isOwner, isGroup, sender);
            }
            continue;
          }

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

            // Guardar nombre del usuario para el .top
            try {
              const _ecoDb = loadDB();
              const _rawSender = msg?.key?.participant || msg?.key?.remoteJid || sender || "";
              const _ecoId = _rawSender.endsWith("@lid")
                ? (msg?.key?.senderPn
                    ? msg.key.senderPn.replace(/\D/g, "")
                    : numId(sender))
                : numId(_rawSender);
              getUser(_ecoDb, _ecoId);
              saveNombre(_ecoDb, _ecoId, msg?.pushName);
              saveDB(_ecoDb);
            } catch {}

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