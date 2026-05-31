import fs from "fs-extra";

const CONFIG_PATH = "./data/antispamConfig.json";
const INFRACTIONS_PATH = "./data/antispamInfractions.json";

// ─── Constantes ───────────────────────────────────────────────────────────────
const BOT_OWNER = "573223090406@s.whatsapp.net";

function cleanJid(jid = "") {
  return String(jid).split(":")[0].trim();
}

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  enabled: [],
  floodLimit: 5,
  floodWindow: 5000,
  repeatLimit: 3,
  maxInfractions: 3,
};

// ─── Helpers de config ────────────────────────────────────────────────────────
async function loadConfig() {
  try { return await fs.readJson(CONFIG_PATH); }
  catch { return { ...DEFAULT_CONFIG }; }
}

async function saveConfig(config) {
  await fs.ensureDir("./data");
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

async function loadInfractions() {
  try { return await fs.readJson(INFRACTIONS_PATH); }
  catch { return {}; }
}

async function saveInfractions(data) {
  await fs.ensureDir("./data");
  await fs.writeJson(INFRACTIONS_PATH, data, { spaces: 2 });
}

export async function isAntispamEnabled(groupJid) {
  const config = await loadConfig();
  return config.enabled.includes(groupJid);
}

async function enableAntispam(groupJid) {
  const config = await loadConfig();
  if (!config.enabled.includes(groupJid)) {
    config.enabled.push(groupJid);
    await saveConfig(config);
  }
}

async function disableAntispam(groupJid) {
  const config = await loadConfig();
  config.enabled = config.enabled.filter((j) => j !== groupJid);
  await saveConfig(config);
}

// ─── Infracciones ─────────────────────────────────────────────────────────────
async function addInfraction(groupJid, userJid) {
  const data = await loadInfractions();
  const key = `${groupJid}__${userJid}`;
  data[key] = (data[key] || 0) + 1;
  await saveInfractions(data);
  return data[key];
}

async function getInfractions(groupJid, userJid) {
  const data = await loadInfractions();
  return data[`${groupJid}__${userJid}`] || 0;
}

export async function resetInfractions(groupJid, userJid) {
  const data = await loadInfractions();
  delete data[`${groupJid}__${userJid}`];
  await saveInfractions(data);
}

// ─── Borrar mensaje de spam ───────────────────────────────────────────────────
async function deleteSpamMsg(sock, msg) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
  } catch (e) {
    console.error("[antispam] No se pudo borrar mensaje:", e.message);
  }
}

// ─── Expulsar usuario ─────────────────────────────────────────────────────────
async function kickUser(sock, groupJid, userJid) {
  try {
    await sock.groupParticipantsUpdate(groupJid, [userJid], "remove");
  } catch (e) {
    console.error("[antispam] No se pudo expulsar:", e.message);
  }
}

// ─── Detectar flood ───────────────────────────────────────────────────────────
async function checkFlood(sock, msg, groupJid, sender, config) {
  const data = await loadInfractions();
  const key = `flood__${groupJid}__${sender}`;
  const now = Date.now();
  const entry = data[key] || { count: 0, since: now, lastMsg: "" };

  if (now - entry.since > config.floodWindow) {
    data[key] = { count: 1, since: now, lastMsg: entry.lastMsg };
    await saveInfractions(data);
    return false;
  }

  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text || "";

  const isRepeat = body && body === entry.lastMsg;
  entry.count += 1;
  entry.lastMsg = body;
  data[key] = entry;
  await saveInfractions(data);

  const isFlood = entry.count >= config.floodLimit;
  const isSpamRepeat = isRepeat && entry.count >= config.repeatLimit;

  return isFlood || isSpamRepeat;
}

// ─── Checker principal ────────────────────────────────────────────────────────
export async function checkAntispam(sock, msg, jid, sender) {
  try {
    if (!jid?.endsWith("@g.us")) return false;
    if (!await isAntispamEnabled(jid)) return false;

    // Nunca sancionar al owner del bot
    if (cleanJid(sender) === cleanJid(BOT_OWNER)) return false;

    const config = await loadConfig();
    const isSpam = await checkFlood(sock, msg, jid, sender, config);
    if (!isSpam) return false;

    await deleteSpamMsg(sock, msg);

    const total = await addInfraction(jid, sender);
    const senderNum = sender.split("@")[0];
    const remaining = config.maxInfractions - total;

    if (total >= config.maxInfractions) {
      await resetInfractions(jid, sender);
      await kickUser(sock, jid, sender);
      await sock.sendMessage(jid, {
        text:
          `🚫 *@${senderNum} fue expulsado por spam*\n\n` +
          `Acumuló *${config.maxInfractions} infracciones* y fue removido del grupo.`,
        mentions: [sender],
      });
    } else {
      await sock.sendMessage(jid, {
        text:
          `⚠️ *@${senderNum}, para el spam!*\n\n` +
          `📌 Infracción *${total}/${config.maxInfractions}*\n` +
          `${remaining === 1 ? "❗ Próxima infracción = *expulsión*" : `⏳ Te quedan *${remaining}* advertencias`}`,
        mentions: [sender],
      });
    }

    return true;
  } catch (e) {
    console.error("[antispam] Error:", e);
    return false;
  }
}

// ─── Comando .antispam ────────────────────────────────────────────────────────
export default {
  name: "antispam",
  aliases: ["spam"],
  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const { reply } = await import("../../utils.js");

    if (!isGroup) {
      return reply(sock, jid, "❌ Solo funciona en grupos.", msg);
    }

    const isBotOwner = cleanJid(sender) === cleanJid(BOT_OWNER);

    if (!isBotOwner) {
      try {
        const metadata = await sock.groupMetadata(jid);
        const participants = metadata?.participants || [];
        const me = participants.find((p) => cleanJid(p?.id) === cleanJid(sender));
        const isAdmin = me?.admin === "admin" || me?.admin === "superadmin";
        if (!isAdmin) {
          return reply(sock, jid, "❌ Solo admins pueden usar este comando.", msg);
        }
      } catch {
        return reply(sock, jid, "❌ No pude verificar tus permisos.", msg);
      }
    }

    const sub = args[0]?.toLowerCase();

    if (sub === "reset") {
      let targets = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!targets.length) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const quotedSender = quoted?.participant || quoted?.remoteJid;
        if (quotedSender) targets = [quotedSender];
      }
      if (!targets.length) {
        return reply(sock, jid, "❌ Menciona al usuario o responde su mensaje: *.antispam reset @usuario*", msg);
      }
      for (const t of targets) await resetInfractions(jid, t);
      const nombres = targets.map(t => `@${t.split("@")[0]}`).join(", ");
      return reply(sock, jid, `✅ Infracciones de ${nombres} reseteadas.`, msg);
    }

    if (sub === "status" || sub === "ver") {
      let targets = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!targets.length) {
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        const quotedSender = quoted?.participant || quoted?.remoteJid;
        if (quotedSender) targets = [quotedSender];
      }
      if (!targets.length) {
        return reply(sock, jid, "❌ Menciona al usuario o responde su mensaje: *.antispam status @usuario*", msg);
      }
      const config = await loadConfig();
      const lineas = await Promise.all(
        targets.map(async t => {
          const total = await getInfractions(jid, t);
          return `👤 @${t.split("@")[0]}: *${total}/${config.maxInfractions}* infracciones`;
        })
      );
      return await sock.sendMessage(jid, {
        text: `📊 *Infracciones Antispam*\n\n${lineas.join("\n")}`,
        mentions: targets,
      }, { quoted: msg });
    }

    if (!sub || !["on", "off"].includes(sub)) {
      const estado = await isAntispamEnabled(jid);
      return reply(sock, jid,
        `ℹ️ Antispam en este grupo: *${estado ? "ACTIVADO 🟢" : "DESACTIVADO 🔴"}*\n\n` +
        `Uso:\n` +
        `*.antispam on* → activar\n` +
        `*.antispam off* → desactivar\n` +
        `*.antispam reset @usuario* → borrar infracciones\n` +
        `*.antispam status @usuario* → ver infracciones`,
        msg
      );
    }

    if (sub === "on") {
      await enableAntispam(jid);
      return reply(sock, jid, "🟢 Antispam *activado* en este grupo.\n⚠️ 3 infracciones = expulsión automática.", msg);
    }

    if (sub === "off") {
      await disableAntispam(jid);
      return reply(sock, jid, "🔴 Antispam *desactivado* en este grupo.", msg);
    }
  },
};