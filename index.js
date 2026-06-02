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

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGGER DE DEBUG
// ═══════════════════════════════════════════════════════════════════════════════
function ts() {
  return new Date().toISOString();
}

function dbg(tag, data) {
  console.log(`\n[${ts()}] ◆ ${tag}`);
  if (data !== undefined) {
    if (typeof data === "string") {
      console.log("  →", data);
    } else {
      try {
        console.log(JSON.stringify(data, null, 2));
      } catch {
        console.log("  → [no serializable]", data);
      }
    }
  }
}

function dbgWarn(tag, data) {
  console.warn(`\n[${ts()}] ⚠️  ${tag}`);
  if (data !== undefined) console.warn(JSON.stringify(data, null, 2));
}

function dbgErr(tag, data) {
  console.error(`\n[${ts()}] ❌ ${tag}`);
  if (data !== undefined) console.error(data);
}

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

// ═══════════════════════════════════════════════════════════════════════════════
//  BOT
// ═══════════════════════════════════════════════════════════════════════════════
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
    dbgErr("useMultiFileAuthState FALLÓ — sesión corrupta", e);
    if (sessionRetries < MAX_SESSION_RETRIES) {
      sessionRetries++;
      dbgWarn(`Auto-reparando... (${sessionRetries}/${MAX_SESSION_RETRIES})`);
      await clearSession();
      setTimeout(startBot, 2000);
    } else {
      dbgErr("No se pudo reparar. Borra la carpeta de sesión manualmente.");
    }
    return;
  }

  const { version } = await fetchLatestBaileysVersion();
  dbg("BAILEYS VERSION", version);

  const logger = pino({ level: "silent" });
  logger.child = () => logger;

  const sock = makeWASocket({
    version,
    browser: Browsers.ubuntu("Chrome"),
    logger,
    auth: state,
    printQRInTerminal: false,
    getMessage: async (key) => {
      dbg("getMessage llamado", { id: key.id, remoteJid: key.remoteJid });
      if (sock.msgStore?.has(key.id)) {
        const cached = sock.msgStore.get(key.id)?.message || { conversation: "" };
        dbg("getMessage → encontrado en msgStore", cached);
        return cached;
      }
      dbgWarn("getMessage → NO encontrado, devolviendo vacío", { id: key.id });
      return { conversation: "" };
    },
  });

  sock.msgStore = new Map();

  // ── Interceptar sendMessage para loguear cada envío ──────────────────────
  const _originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options) => {
    dbg("sendMessage LLAMADO", {
      jid,
      content: JSON.stringify(content, null, 2),
      options: JSON.stringify(options || {}, null, 2),
    });
    try {
      const result = await _originalSendMessage(jid, content, options);
      dbg("sendMessage OK", { jid, resultKey: result?.key });
      return result;
    } catch (e) {
      dbgErr(`sendMessage FALLÓ para jid=${jid}`, e);
      throw e;
    }
  };

  sock.ev.on("creds.update", (...args) => {
    dbg("EVENT: creds.update", "credenciales actualizadas");
    saveCreds(...args);
  });

  // ── Pedir código si no hay sesión ─────────────────────────────────────────
  if (!state.creds.registered) {
    dbg("PAIRING: no hay sesión registrada, solicitando código", { PHONE_NUMBER });
    console.log(`\n⏳ Solicitando código para: ${PHONE_NUMBER}`);
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log("\n╔══════════════════════════════════════╗");
      console.log(`   🔑 CÓDIGO DE VINCULACIÓN: ${code}   `);
      console.log("╚══════════════════════════════════════╝");
      console.log("\n  WhatsApp > Dispositivos vinculados");
      console.log("  > Vincular con número de teléfono\n");
      dbg("PAIRING: código generado", code);
    } catch (e) {
      dbgErr("PAIRING: error al pedir código", e);
      console.log("⚠️  Reinicia el bot e intenta de nuevo.");
    }
  } else {
    dbg("PAIRING: sesión ya registrada, no se pide código");
  }

  // ── Eventos de grupo ──────────────────────────────────────────────────────
  setupAutoPromote(sock);
  setupWelcomeEvent(sock);
  setupGoodbyeEvent(sock);
  iniciarCronBuenasNoches(sock);

  // ── connection.update ─────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    dbg("EVENT: connection.update", update);
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      dbg("CONEXIÓN: conectando...");
      return;
    }

    if (connection === "open") {
      sessionRetries = 0;
      dbg("CONEXIÓN: OPEN — bot conectado", {
        user: sock.user,
        botName: CONFIG.botName,
      });
      console.log(`\n✅ ${CONFIG.botName} conectado!`);
      registerAntiDelete(sock);
      return;
    }

    if (connection === "close") {
      const statusCode   = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut  = statusCode === DisconnectReason.loggedOut;
      const isBadSession = statusCode === DisconnectReason.badSession;
      const isConflict   = statusCode === DisconnectReason.connectionReplaced;

      dbgErr("CONEXIÓN: CLOSE", {
        statusCode,
        isLoggedOut,
        isBadSession,
        isConflict,
        error: lastDisconnect?.error?.message,
        stack: lastDisconnect?.error?.stack,
      });

      if (isLoggedOut || isBadSession) {
        dbgWarn("Sesión inválida — borrando y reiniciando");
        await clearSession();
        if (sessionRetries < MAX_SESSION_RETRIES) {
          sessionRetries++;
          setTimeout(startBot, 3000);
        } else {
          dbgErr("Demasiados intentos fallidos. Reinicia manualmente.");
        }
      } else if (isConflict) {
        dbgWarn("Bot abierto en otro lugar. Cerrando esta instancia.");
        process.exit(0);
      } else {
        dbgWarn(`Reconectando en 3s... (status=${statusCode})`);
        setTimeout(startBot, 3000);
      }
    }
  });

  // ── messages.update ───────────────────────────────────────────────────────
  sock.ev.on("messages.update", (updates) => {
    dbg(`EVENT: messages.update (${updates.length} updates)`);
    for (const u of updates) {
      dbg("messages.update item", {
        key: u.key,
        update: u.update,
      });
    }
  });

  // ── messages.reaction ─────────────────────────────────────────────────────
  sock.ev.on("messages.reaction", (reactions) => {
    dbg(`EVENT: messages.reaction (${reactions.length})`);
    for (const r of reactions) {
      dbg("messages.reaction item", r);
    }
  });

  // ── group-participants.update ─────────────────────────────────────────────
  sock.ev.on("group-participants.update", (update) => {
    dbg("EVENT: group-participants.update", update);
  });

  // ── groups.update ─────────────────────────────────────────────────────────
  sock.ev.on("groups.update", (updates) => {
    dbg(`EVENT: groups.update (${updates.length})`);
    for (const u of updates) dbg("groups.update item", u);
  });

  // ── presence.update ───────────────────────────────────────────────────────
  sock.ev.on("presence.update", (p) => {
    dbg("EVENT: presence.update", p);
  });

  // ── chats.update ──────────────────────────────────────────────────────────
  sock.ev.on("chats.update", (updates) => {
    dbg(`EVENT: chats.update (${updates.length})`);
  });

  // ── contacts.update ───────────────────────────────────────────────────────
  sock.ev.on("contacts.update", (updates) => {
    dbg(`EVENT: contacts.update (${updates.length})`);
  });

  // ── messages.upsert ───────────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    dbg(`EVENT: messages.upsert — type="${type}", cantidad=${messages.length}`);

    if (type !== "notify") {
      dbgWarn(`messages.upsert ignorado por type="${type}"`);
      return;
    }

    for (const msg of messages) {
      const stanzaId  = msg?.key?.id;
      const remoteJid = msg?.key?.remoteJid;
      const participant = msg?.key?.participant;
      const fromMe    = msg?.key?.fromMe;
      const pushName  = msg?.pushName;
      const messageStubType = msg?.messageStubType;
      const messageStubParameters = msg?.messageStubParameters;
      const isLid     = remoteJid?.endsWith("@lid") || participant?.endsWith("@lid");

      dbg("─── MENSAJE RECIBIDO ───", {
        stanzaId,
        remoteJid,
        participant,
        fromMe,
        pushName,
        messageStubType,
        messageStubParameters,
        isLid,
        tieneMessage: !!msg?.message,
        tiposDeMessage: msg?.message ? Object.keys(msg.message) : [],
      });

      // Detección de duplicados
      if (mensajesProcesados.has(stanzaId)) {
        dbgWarn(`[DUPLICADO] stanzaId=${stanzaId} ya fue procesado antes — SALTANDO`);
        continue;
      }

      try {
        if (!msg?.message) {
          dbgWarn(`msg.message es null/undefined para stanzaId=${stanzaId} — SALTANDO`);
          dbg("MENSAJE COMPLETO (sin .message)", JSON.stringify(msg, null, 2));
          continue;
        }

        dbg("CONTENIDO COMPLETO msg.message", JSON.stringify(msg.message, null, 2));

        mensajesProcesados.add(stanzaId);
        setTimeout(() => {
          mensajesProcesados.delete(stanzaId);
          dbg(`[DUPLICADOS] stanzaId=${stanzaId} eliminado del set tras 60s`);
        }, 60000);

        let jid = remoteJid;

        // Resolver LID → JID real
        if (jid?.endsWith("@lid")) {
          dbgWarn(`JID es @lid: ${jid} — intentando resolver`);
          if (msg.key?.senderPn) {
            jid = msg.key.senderPn.includes("@")
              ? msg.key.senderPn
              : `${msg.key.senderPn}@s.whatsapp.net`;
            dbg(`LID resuelto via senderPn → ${jid}`);
          } else {
            const senderNum = (getSender(msg) || "").split("@")[0];
            if (senderNum) {
              jid = `${senderNum}@s.whatsapp.net`;
              dbg(`LID resuelto via getSender → ${jid}`);
            } else {
              dbgWarn(`No se pudo resolver LID para stanzaId=${stanzaId}`);
            }
          }
        }

        const sender  = getSender(msg);
        const isOwner = sender === OWNER;

        dbg("SENDER INFO", {
          sender,
          isOwner,
          jidResuelto: jid,
          jidOriginal: remoteJid,
          esLid: isLid,
        });

        if (fromMe) {
          dbg("🔵 FROM ME", { sender, jid });
        }

        const tempBody =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text || "";

        dbg("tempBody (pre-filtro fromMe)", { tempBody, fromMe, startsWithPrefix: tempBody.startsWith(CONFIG.prefix) });

        if (fromMe && !tempBody.startsWith(CONFIG.prefix)) {
          dbg(`fromMe=true y no empieza con prefix "${CONFIG.prefix}" — SALTANDO`);
          continue;
        }

        const isGroup = jid?.endsWith("@g.us");
        const { tipo, detalle, body } = getMsgInfo(msg);

        dbg("getMsgInfo resultado", { tipo, detalle, body, isGroup });

        if (tipo === "desconocido") {
          dbgWarn("TIPO DESCONOCIDO — volcando msg.message completo");
          console.log(JSON.stringify(msg.message, null, 2));
        }

        if (tipo === "vacío") {
          dbgWarn(`TIPO VACÍO para stanzaId=${stanzaId} — esto puede causar mensajes vacíos`);
          dbg("msg completo tipo vacío", JSON.stringify(msg, null, 2));
        }

        // Logger original
        console.log("=".repeat(70));
        console.log(`📩 DE: ${sender} | 📱 CHAT: ${jid}`);
        console.log(`🆔 ID: ${stanzaId}`);
        console.log(`📦 TIPO: ${tipo} | 📝 ${detalle}`);
        console.log("=".repeat(70));

        if (!body && !msg.message?.documentMessage) {
          dbgWarn(`body vacío y no es documento para stanzaId=${stanzaId} — SALTANDO`);
          dbg("Estado en este punto", { body, tieneDocumento: !!msg.message?.documentMessage, tipo });
          continue;
        }

        // msgStore
        sock.msgStore.set(stanzaId, msg);
        if (sock.msgStore.size > MSG_STORE_LIMIT) {
          sock.msgStore.delete(sock.msgStore.keys().next().value);
        }
        dbg(`msgStore actualizado — tamaño: ${sock.msgStore.size}`);

        // Auto-forward documentos
        dbg("Llamando checkAutoForward");
        await checkAutoForward(sock, msg);

        // Anti-link
        dbg("Llamando checkAntiLink");
        const antiLink = await checkAntiLink(sock, msg, jid, sender, body);
        if (antiLink) { dbgWarn("checkAntiLink retornó true — SALTANDO"); continue; }

        // Anti-spam
        dbg("Llamando checkAntispam");
        const antiSpam = await checkAntispam(sock, msg, jid, sender);
        if (antiSpam) { dbgWarn("checkAntispam retornó true — SALTANDO"); continue; }

        // Control de grupos permitidos
        if (isGroup && !isOwner) {
          const permitido = await grupoPermitido(jid);
          dbg("grupoPermitido", { jid, permitido });
          if (!permitido) { dbgWarn(`Grupo ${jid} no permitido — SALTANDO`); continue; }
        }

        // Mantenimiento
        if (estado.mantenimiento && !isOwner) {
          dbgWarn("Modo mantenimiento activo — SALTANDO");
          continue;
        }

        // IA por mención
        if (isGroup && body && !body.startsWith(CONFIG.prefix)) {
          const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          dbg("Chequeando menciones de IA", { menciones });

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

              dbg("Resultado mención IA", { botNum, botLid, esMencionado });

              if (esMencionado) {
                const textoSinMencion = body.replace(/@\d+/g, "").trim();
                dbg("Ejecutando IA por mención", { textoSinMencion });
                if (textoSinMencion) {
                  await iaCmd.run(sock, msg, textoSinMencion.split(" "), jid, false, false);
                  continue;
                }
              }
            } catch (e) {
              dbgErr("[IA MENCION ERROR]", e);
            }
          }
        }

        // Sin prefix — sesiones activas
        if (!body.startsWith(CONFIG.prefix)) {
          const bodyTrim = body.trim();
          dbg("Sin prefix — chequeando sesiones activas", { bodyTrim });

          const sesionJuego = getSesionJuego(jid, sender);
          if (sesionJuego) {
            dbg("Sesión de juego activa", { jid, sender });
            if (commands["numjuego"]) {
              await commands["numjuego"](sock, msg, [bodyTrim], jid, isOwner, isGroup, sender);
            }
            continue;
          }

          if (sesiones.has(sender) && ["1", "2"].includes(bodyTrim)) {
            dbg("[SESION apkdl] Respuesta recibida", { bodyTrim, sender });
            const sesion = sesiones.get(sender);
            sesiones.delete(sender);
            const prefer = bodyTrim === "1" ? "apk" : "xapk";
            await descargarApk(sock, msg, jid, sesion.query, prefer);
          }

          continue;
        }

        // Comandos
        const [rawCmd, ...args] = body.slice(CONFIG.prefix.length).trim().split(/\s+/);
        if (!rawCmd) {
          dbgWarn("rawCmd vacío tras quitar prefix — SALTANDO");
          continue;
        }

        const cmd = rawCmd.toLowerCase();
        dbg(`COMANDO detectado: "${cmd}"`, { args });

        if (commands[cmd]) {
          const tStart = Date.now();
          try {
            if (!SELF_REACT_CMDS.has(cmd)) {
              dbg(`react ⏳ para "${cmd}"`);
              try {
                await react(sock, msg, "⏳");
              } catch (re) {
                dbgErr(`react() FALLÓ para "${cmd}"`, re);
              }
            }

            // Guardar nombre del usuario
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

            dbg(`COMANDO INICIO: "${cmd}"`, { args, sender, jid, ts: ts() });
            await commands[cmd](sock, msg, args, jid, isOwner, isGroup, sender);
            const elapsed = Date.now() - tStart;
            dbg(`COMANDO FIN: "${cmd}" — tardó ${elapsed}ms`);

            if (!SELF_REACT_CMDS.has(cmd)) {
              dbg(`react ✅ para "${cmd}"`);
              try {
                await react(sock, msg, "✅");
              } catch (re) {
                dbgErr(`react() ✅ FALLÓ para "${cmd}"`, re);
              }
            }

          } catch (e) {
            const elapsed = Date.now() - tStart;
            dbgErr(`COMANDO ERROR: "${cmd}" tras ${elapsed}ms`, e);
            try {
              await react(sock, msg, "❌");
            } catch (re) {
              dbgErr(`react() ❌ FALLÓ para "${cmd}"`, re);
            }
            try {
              await reply(sock, jid, `❌ Error en el comando: ${e.message}`, msg);
            } catch (re) {
              dbgErr(`reply() FALLÓ para "${cmd}"`, re);
            }
          }
        } else {
          dbg(`Comando "${cmd}" no encontrado en el mapa de comandos`);
        }

      } catch (e) {
        dbgErr(`Error general en messages.upsert para stanzaId=${stanzaId}`, e);
      }
    }
  });
}

startBot();