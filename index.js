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
const OWNER           = "573223090406@s.whatsapp.net";
const SESSION_FILE    = "./session_phone.json";
const MAX_RETRIES     = 5;

// Delay base entre reconexiones (ms). Se duplica con cada intento (backoff exponencial).
const BASE_RECONNECT_DELAY = 3000;

// Comandos que manejan sus propias reacciones
const SELF_REACT_CMDS = new Set([
  "tt", "tiktok", "ttsearch",
  "fb", "facebook", "fbmp4",
  "ytmp3", "play", "mp3", "song",
  "ytmp4", "video", "yt",
  "spotify", "sp", "spdl",
  "applemusic", "amusic", "apple", "am",
]);

// ─── Logger silencioso ────────────────────────────────────────────────────────
// IMPORTANTE: Baileys usa logger.child() para crear sub-loggers (Signal, session, etc.)
// Si no se sobreescribe child(), los sub-loggers heredan el nivel real y spamean
// "Closing session", rotaciones de clave Signal, etc.
// Esta función crea un logger completamente mudo para todo Baileys.
function crearLoggerSilencioso() {
  const noop = () => {};
  const logger = {
    level: "silent",
    trace: noop, debug: noop, info: noop,
    warn:  noop, error: noop, fatal: noop,
  };
  // child() debe devolver otro logger igualmente mudo (evita el spam de sesión Signal)
  logger.child = () => logger;
  return logger;
}

// ─── Estado global ────────────────────────────────────────────────────────────
let sock             = null;
let reconnectTimer   = null;
let sessionRetries   = 0;
let eventosRegistrados = false; // ← evita registrar listeners de grupo duplicados
let commands         = {};

// Set con TTL para deduplicar mensajes (limpieza automática, no depende de reconexión)
const mensajesProcesados = new Set();

// ─── Init ─────────────────────────────────────────────────────────────────────
await fs.ensureDir(TEMP_DIR);
commands = await loadCommands();
console.log(`✅ ${Object.keys(commands).length} comandos cargados:`, Object.keys(commands).join(", "));

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    if (!/^\d{10,15}$/.test(number)) console.log("  ❌ Número inválido, intenta de nuevo.\n");
  }

  await fs.writeFile(SESSION_FILE, JSON.stringify({ phone: number }, null, 2));
  console.log(`\n  ✅ Número guardado: ${number}\n`);
  return number;
}

async function clearSession() {
  try {
    if (await fs.pathExists(CONFIG.sessionDir)) {
      await fs.remove(CONFIG.sessionDir);
      console.log("🗑️  Sesión borrada.");
    }
    // Recrear carpeta vacía para evitar ENOENT en saveCreds
    await fs.ensureDir(CONFIG.sessionDir);
  } catch (e) {
    console.error("No se pudo borrar la sesión:", e.message);
  }
}

// Destruir socket actual limpiamente
function destroySock() {
  if (!sock) return;
  try { sock.ev.removeAllListeners(); } catch {}
  try { sock.ws?.terminate();          } catch {} // terminate() es más agresivo que close()
  try { sock.end(undefined);           } catch {}
  sock = null;
}

/**
 * Programa reconexión con backoff exponencial.
 * - Si ya hay un timer activo, NO acumula otro.
 * - delay = BASE * 2^(intentos-1), máx 30 segundos.
 */
function scheduleReconnect() {
  if (reconnectTimer) return; // ya hay uno pendiente, no duplicar

  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, sessionRetries - 1), 30_000);
  console.log(`⏳ Reconectando en ${(delay / 1000).toFixed(1)}s... (intento ${sessionRetries}/${MAX_RETRIES})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startBot();
  }, delay);
}

// ─── Detección de tipo y body del mensaje ─────────────────────────────────────
function getMsgInfo(msg) {
  const m = msg.message;
  if (!m) return { tipo: "vacío", detalle: "", body: "" };

  const body =
    m.conversation                    ||
    m.extendedTextMessage?.text       ||
    m.imageMessage?.caption           ||
    m.videoMessage?.caption           ||
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
  // 1. Siempre destruir instancia anterior
  destroySock();

  const PHONE_NUMBER = await getPhoneNumber();
  await fs.ensureDir(CONFIG.sessionDir);

  // 2. Cargar sesión (con auto-reparación)
  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir));
  } catch (e) {
    console.error("❌ Sesión corrupta:", e.message);
    if (sessionRetries < MAX_RETRIES) {
      sessionRetries++;
      await clearSession();
      scheduleReconnect();
    } else {
      console.error("❌ No se pudo reparar la sesión. Borra la carpeta manualmente.");
    }
    return;
  }

  const { version } = await fetchLatestBaileysVersion();

  // 3. Crear socket con logger completamente silencioso
  //    Esto elimina el spam de "Closing session" y rotaciones Signal
  sock = makeWASocket({
    version,
    browser: Browsers.ubuntu("Chrome"),
    logger: crearLoggerSilencioso(),
    auth: state,
    printQRInTerminal: false,
    // Devolver mensaje del store si existe, evita errores de descifrado
    getMessage: async (key) => {
      return sock?.msgStore?.get(key.id)?.message ?? { conversation: "" };
    },
    // Opciones de reconexión de bajo nivel
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    retryRequestDelayMs: 2000,
  });

  sock.msgStore = new Map();

  // 4. Guardar credenciales en cada cambio
  sock.ev.on("creds.update", saveCreds);

  // 5. Pedir código de vinculación solo si no hay sesión
  const credsPath  = `${CONFIG.sessionDir}/creds.json`;
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

  // 6. Registrar eventos de grupo UNA SOLA VEZ
  //    (Si se llama setupWelcomeEvent en cada reconexión, acumulas listeners duplicados
  //     que pueden causar comportamientos raros o crashes)
  if (!eventosRegistrados) {
    eventosRegistrados = true;
    setupAutoPromote(sock);
    setupWelcomeEvent(sock);
    setupGoodbyeEvent(sock);
    iniciarCronBuenasNoches(sock);
  }

  // ── Conexión ────────────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {

    // QR inesperado (no debería pasar con pairing code, pero por si acaso)
    if (qr) {
      console.log("⚠️  Se generó QR inesperado. Usa el código de vinculación.");
    }

    if (connection === "open") {
      // Resetear contadores al conectar exitosamente
      sessionRetries = 0;
      reconnectTimer = null;
      console.log(`\n✅ ${CONFIG.botName} conectado!`);
      return;
    }

    if (connection === "close") {
      const err        = lastDisconnect?.error;
      const statusCode = err?.output?.statusCode;

      console.log(`❌ Conexión cerrada. Código: ${statusCode ?? "desconocido"}`);
      if (err?.message) console.log(`   Motivo: ${err.message}`);

      // ── Casos donde NO se debe reconectar ───────────────────────────────
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("🗑️  Sesión cerrada por WhatsApp. Borrando y reiniciando...");
        await clearSession();
        // Resetear para que el próximo intento parta de 0
        sessionRetries = 0;
        eventosRegistrados = false; // forzar re-registro de eventos con nueva sesión
        scheduleReconnect();
        return;
      }

      if (statusCode === DisconnectReason.connectionReplaced) {
        // Otra instancia activa — evitar conflicto, salir
        console.log("⚠️  Bot abierto en otro dispositivo/instancia. Cerrando.");
        destroySock();
        process.exit(0);
        return;
      }

      if (statusCode === 405) {
        // Cuenta baneada o acción no permitida por WhatsApp
        console.error("🚫 Cuenta restringida por WhatsApp (405). No se reconecta.");
        destroySock();
        return;
      }

      // ── Reconexión con backoff ───────────────────────────────────────────
      if (sessionRetries < MAX_RETRIES) {
        sessionRetries++;
        scheduleReconnect();
      } else {
        console.error(`❌ ${MAX_RETRIES} intentos fallidos. Reinicia el bot manualmente.`);
        destroySock();
      }
    }
  });

  // ── Mensajes ─────────────────────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      const stanzaId = msg?.key?.id;
      if (!stanzaId) continue;

      // Deduplicación — ignorar si ya procesamos este ID
      if (mensajesProcesados.has(stanzaId)) continue;

      try {
        if (!msg?.message) continue;

        // Marcar como procesado con TTL de 2 minutos
        mensajesProcesados.add(stanzaId);
        setTimeout(() => mensajesProcesados.delete(stanzaId), 120_000);

        let jid = msg.key.remoteJid;
        if (!jid) continue;

        // Resolver LID → JID real
        if (jid.endsWith("@lid")) {
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

        // Ignorar mensajes propios que no sean comandos
        if (msg.key.fromMe && !tempBody.startsWith(CONFIG.prefix)) continue;

        const isGroup             = jid.endsWith("@g.us");
        const { tipo, detalle, body } = getMsgInfo(msg);

        // Logger de consola
        console.log("=".repeat(70));
        console.log(`📩 DE: ${sender} | 📱 CHAT: ${jid}`);
        console.log(`🆔 ID: ${stanzaId}`);
        console.log(`📦 TIPO: ${tipo} | 📝 ${detalle}`);
        console.log("=".repeat(70));

        if (!body && !msg.message?.documentMessage) continue;

        // Guardar en msgStore para descifrado de mensajes referenciados
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

        // Grupos permitidos
        if (isGroup && !isOwner && !await grupoPermitido(jid)) continue;

        // Modo mantenimiento
        if (estado.mantenimiento && !isOwner) {
          await reply(sock, jid,
            `🔧 *El bot está en mantenimiento*\n\n` +
            `⚠️ No disponible por el momento.\n` +
            `Intenta más tarde.`,
            msg
          );
          continue;
        }

        // ─── IA por mención o respuesta al bot en grupos ─────────────────────
        if (isGroup && body && !body.startsWith(CONFIG.prefix)) {
          const menciones        = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          const contextInfo      = msg.message?.extendedTextMessage?.contextInfo;
          const participantQuoted = contextInfo?.participant || "";
          const botNum           = sock.user?.id?.split(":")[0];

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
            // Si groupMetadata falla, intentar con lo que tenemos
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

        // ─── Mensajes sin prefix (sesiones activas) ───────────────────────────
        if (!body.startsWith(CONFIG.prefix)) {
          const bodyTrim = body.trim();

          const sesionJuego = getSesionJuego(jid, sender);
          if (sesionJuego && commands["numjuego"]) {
            await commands["numjuego"](sock, msg, [bodyTrim], jid, isOwner, isGroup, sender);
            continue;
          }

          if (sesiones.has(sender) && ["1", "2"].includes(bodyTrim)) {
            console.log("[SESION] Respuesta:", bodyTrim, "de:", sender);
            const sesion = sesiones.get(sender);
            sesiones.delete(sender);
            const prefer = bodyTrim === "1" ? "apk" : "xapk";
            await descargarApk(sock, msg, jid, sesion.query, prefer);
          }

          continue;
        }

        // ─── Comandos con prefix ──────────────────────────────────────────────
        const [rawCmd, ...args] = body.slice(CONFIG.prefix.length).trim().split(/\s+/);
        if (!rawCmd) continue;

        const cmd = rawCmd.toLowerCase();
        if (!commands[cmd]) continue;

        try {
          if (!SELF_REACT_CMDS.has(cmd)) await react(sock, msg, "⏳");

          // Guardar nombre en base de datos de economía
          try {
            const _ecoDb     = loadDB();
            const _rawSender = msg?.key?.participant || msg?.key?.remoteJid || sender || "";
            const _ecoId     = _rawSender.endsWith("@lid")
              ? (msg?.key?.senderPn
                  ? msg.key.senderPn.replace(/\D/g, "")
                  : numId(sender))
              : numId(_rawSender);
            getUser(_ecoDb, _ecoId);
            saveNombre(_ecoDb, _ecoId, msg?.pushName);
            saveDB(_ecoDb);
          } catch {}

          await commands[cmd](sock, msg, args, jid, isOwner, isGroup, sender);

          if (!SELF_REACT_CMDS.has(cmd)) await react(sock, msg, "✅");

        } catch (e) {
          console.error(`❌ Error en comando "${cmd}":`, e);
          // Solo reaccionar y responder si el socket sigue activo
          if (sock) {
            try { await react(sock, msg, "❌"); } catch {}
            try { await reply(sock, jid, `❌ Error en el comando: ${e.message}`, msg); } catch {}
          }
        }

      } catch (e) {
        console.error("❌ Error procesando mensaje:", e.message);
      }
    }
  });
}

// ─── Manejo de errores globales (evita crash total del proceso) ───────────────
process.on("uncaughtException", (err) => {
  console.error("💥 uncaughtException:", err.message);
  // No salir — dejar que el bot se recupere solo
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 unhandledRejection:", reason?.message ?? reason);
  // No salir — Baileys lanza muchas promesas rechazadas en reconexión
});

process.on("SIGINT",  () => { console.log("\n👋 Cerrando bot..."); destroySock(); process.exit(0); });
process.on("SIGTERM", () => { console.log("\n👋 SIGTERM recibido."); destroySock(); process.exit(0); });

// ─── Arranque ─────────────────────────────────────────────────────────────────
 export default startBot;