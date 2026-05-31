import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { reply } from "../../utils.js";
import { normalizeJid, isOwner } from "../utilidades/permisos.js";

// ─── Persistencia grupos ───────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "antilink_groups.json");
const INFRACCIONES_FILE = path.join(__dirname, "antilink_infracciones.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return new Set(fs.readJsonSync(DATA_FILE));
  } catch (e) {
    console.error("⚠️ antilink: error cargando datos:", e.message);
  }
  return new Set();
}

function saveData(set) {
  try {
    fs.writeJsonSync(DATA_FILE, [...set], { spaces: 2 });
  } catch (e) {
    console.error("⚠️ antilink: error guardando datos:", e.message);
  }
}

// ─── Persistencia infracciones ────────────────────────────────────────────────
function loadInfracciones() {
  try {
    if (fs.existsSync(INFRACCIONES_FILE)) return fs.readJsonSync(INFRACCIONES_FILE);
  } catch (e) {
    console.error("⚠️ antilink: error cargando infracciones:", e.message);
  }
  return {};
}

function saveInfracciones(data) {
  try {
    fs.writeJsonSync(INFRACCIONES_FILE, data, { spaces: 2 });
  } catch (e) {
    console.error("⚠️ antilink: error guardando infracciones:", e.message);
  }
}

function getInfracciones(jid, sender) {
  const data = loadInfracciones();
  return data[`${jid}:${sender}`] || 0;
}

function addInfraccion(jid, sender) {
  const data = loadInfracciones();
  const key = `${jid}:${sender}`;
  data[key] = (data[key] || 0) + 1;
  saveInfracciones(data);
  return data[key];
}

function resetInfraccion(jid, sender) {
  const data = loadInfracciones();
  delete data[`${jid}:${sender}`];
  saveInfracciones(data);
}

export const antiLinkGroups = loadData();

const MAX_INFRACCIONES = 3;

// ─── Permisos ─────────────────────────────────────────────────────────────────
async function isGroupAdmin(sock, jid, userJid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(
      (p) => normalizeJid(p.id) === normalizeJid(userJid)
    );
    return (
      !!participant &&
      (participant.admin === "admin" || participant.admin === "superadmin")
    );
  } catch {
    return false;
  }
}

async function canToggle(sock, jid, sender) {
  if (isOwner(sender)) return true;
  if (jid?.endsWith("@g.us")) return await isGroupAdmin(sock, jid, sender);
  return false;
}

// ─── Extraer texto completo ────────────────────────────────────────────────────
function extractFullText(msg) {
  const m = msg?.message;
  if (!m) return "";
  const parts = [
    m.conversation,
    m.extendedTextMessage?.text,
    m.extendedTextMessage?.matchedText,
    m.extendedTextMessage?.canonicalUrl,
    m.imageMessage?.caption,
    m.videoMessage?.caption,
    m.documentMessage?.caption,
    m.buttonsMessage?.contentText,
    m.listMessage?.description,
  ];
  return parts.filter(Boolean).join(" ");
}

const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|net|org|io|co|app|me|ly|gg|link|to|chat))/i;

// ─── checkAntiLink ────────────────────────────────────────────────────────────
export async function checkAntiLink(sock, msg, jid, sender, body) {
  if (!jid?.endsWith("@g.us")) return false;
  if (!antiLinkGroups.has(jid)) return false;

  const fullText = extractFullText(msg);
  if (!LINK_REGEX.test(fullText)) return false;

  const esAdmin = await isGroupAdmin(sock, jid, sender);
  const esOwner = isOwner(sender);
  if (esAdmin || esOwner) return false;

  console.log(`[ANTILINK] Link detectado de ${sender} en ${jid}`);

  try {
    await sock.sendMessage(jid, { delete: msg.key });
  } catch (e) {
    console.error("[ANTILINK] No pude borrar el mensaje:", e.message);
  }

  const count = addInfraccion(jid, sender);
  const restantes = MAX_INFRACCIONES - count;

  if (count >= MAX_INFRACCIONES) {
    resetInfraccion(jid, sender);
    try {
      await sock.sendMessage(jid, {
        text: `🚫 @${normalizeJid(sender)} fue *expulsado* por gey.`,
        mentions: [sender],
      });
      await sock.groupParticipantsUpdate(jid, [sender], "remove");
    } catch (e) {
      console.error("[ANTILINK] No pude expulsar:", e.message);
      await sock.sendMessage(jid, {
        text: `⚠️ @${normalizeJid(sender)} alcanzó el límite pero no pude expulsarlo. ¿Soy admin?`,
        mentions: [sender],
      });
    }
  } else {
    const advertencia = restantes === 1
      ? `⚠️ *última advertencia* antes de ser expulsado por gey`
      : `⚠️ te quedan *${restantes}* advertencias antes de ser expulsado por gey`;

    await sock.sendMessage(jid, {
      text: `🔗 @${normalizeJid(sender)} los links no están permitidos aquí.\n${advertencia} _(${count}/${MAX_INFRACCIONES})_`,
      mentions: [sender],
    });
  }

  return true;
}

// ─── Comando .antilink ────────────────────────────────────────────────────────
export default {
  name: "antilink",
  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const input = (args[0] || "").toLowerCase();

    if (!input || input === "status" || input === "estado") {
      const estado = isGroup
        ? antiLinkGroups.has(jid)
          ? "🟢 *ACTIVADO*"
          : "🔴 *DESACTIVADO*"
        : "❌ Solo aplica en grupos";

      return reply(sock, jid,
        `🔗 *Anti-link*\n\nEstado: ${estado}\n🚫 Límite: *${MAX_INFRACCIONES} links* antes de expulsión\n\n📌 Uso:\n*.antilink on* — activar\n*.antilink off* — desactivar\n*.antilink reset @usuario* — resetear advertencias`,
        msg
      );
    }

    if (input === "on" || input === "off") {
      if (!isGroup)
        return reply(sock, jid, "❌ Este ajuste solo aplica en grupos.", msg);

      const puedeToggle = await canToggle(sock, jid, sender);
      if (!puedeToggle)
        return reply(sock, jid, "❌ Solo los admins o el owner pueden hacer eso.", msg);

      if (input === "on") {
        antiLinkGroups.add(jid);
        saveData(antiLinkGroups);
        return reply(sock, jid,
          `✅ Anti-link *activado*.\nLos links serán eliminados y al *${MAX_INFRACCIONES}er link* el usuario será expulsado.`,
          msg
        );
      } else {
        antiLinkGroups.delete(jid);
        saveData(antiLinkGroups);
        return reply(sock, jid, "🔴 Anti-link *desactivado*.", msg);
      }
    }

    if (input === "reset") {
      const puedeToggle = await canToggle(sock, jid, sender);
      if (!puedeToggle)
        return reply(sock, jid, "❌ Solo los admins o el owner pueden hacer eso.", msg);

      // Por mención o por respuesta de mensaje
      let targets = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!targets.length) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const quotedSender = quoted?.participant || quoted?.remoteJid;
        if (quotedSender) targets = [quotedSender];
      }

      if (!targets.length)
        return reply(sock, jid,
          "❌ Menciona al usuario o responde su mensaje.\nEjemplo: *.antilink reset @usuario*",
          msg
        );

      targets.forEach(u => resetInfraccion(jid, u));
      const nombres = targets.map(t => `@${t.split("@")[0]}`).join(", ");
      return reply(sock, jid, `✅ Advertencias reseteadas para ${nombres}.`, msg);
    }

    return reply(sock, jid,
      "❓ Uso:\n*.antilink on* — activar\n*.antilink off* — desactivar\n*.antilink reset @usuario* — resetear advertencias\n*.antilink status* — ver estado",
      msg
    );
  },
};