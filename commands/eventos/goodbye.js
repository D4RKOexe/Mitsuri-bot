import { normalizeJid } from "../utilidades/permisos.js";
import { isGoodbyeEnabled, enableGoodbye, disableGoodbye } from "./goodbyeConfig.js";

const GOODBYE_DELAY = 3000;
const BETWEEN_USERS_DELAY = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanJid(jid = "") {
  return String(jid).split(":")[0].trim();
}

// ─── Construir texto de despedida ─────────────────────────────────────────────
async function buildGoodbyeText(sock, groupJid, jidUser) {
  let metadata = {};
  try {
    metadata = await sock.groupMetadata(groupJid);
  } catch (e) {
    console.error("No pude obtener metadata del grupo:", e);
  }

  const groupName = metadata?.subject || "este grupo";
  const total = metadata?.participants?.length || null;
  const tag = normalizeJid(jidUser);

const texto = [
    "╭━━━〔 🤣 SE VA POR GEY 🤣 〕━━━⬣",
    `┃ @${tag} se salió por gey jajaja`,
    `┃ Abandona *${groupName}*`,
    total ? `┃ Ahora quedamos *${total}* cracks` : "┃",
    "┃",
    "┃ 😂 Ni lo extrañaremos, gey",
    "┃ 🖕 ¡Y pa' qué vuelvas!",
    "╰━━━━━━━━━━━━━━━━━━━━⬣",
  ].join("\n");

  return { texto, metadata };
}

// ─── Enviar despedida ─────────────────────────────────────────────────────────
async function sendGoodbye(sock, groupJid, jidUser) {
  if (!jidUser) return;
  try {
    const { texto } = await buildGoodbyeText(sock, groupJid, jidUser);
    await sock.sendMessage(groupJid, {
      text: texto,
      mentions: [jidUser],
    });
  } catch (e) {
    console.error("Error enviando despedida:", e);
  }
}

// ─── Verificar admin/owner ────────────────────────────────────────────────────
async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];

    const targetNum = userJid.split("@")[0].split(":")[0].trim();

    const participant = participants.find((p) => {
      // Comparar por número de teléfono si está disponible
      const pPhone = (p?.phoneNumber || "").replace(/\D/g, "");
      const pNum = (p?.id || "").split("@")[0].split(":")[0].trim();
      const pLid = (p?.lid || "").split("@")[0].split(":")[0].trim();
      return pNum === targetNum || pLid === targetNum || pPhone === targetNum;
    });

    // Si no encontró por número, buscar por el LID del bot que conocemos
    // El bot sabe su propio LID: sock.user
    const botLid = sock.user?.id?.split(":")[0];
    const myLid = userJid === `${targetNum}@s.whatsapp.net`
      ? participants.find(p => {
          const ppn = (p?.phoneNumber || "").replace(/\D/g, "");
          return ppn === targetNum;
        })
      : null;

    const finalParticipant = participant || myLid;

    const isAdmin = Boolean(
      finalParticipant?.admin === "admin" ||
      finalParticipant?.admin === "superadmin"
    );

    const ownerNum = (metadata?.owner || "").split("@")[0].split(":")[0].trim();
    const isOwner = ownerNum === targetNum;

    console.log("[GOODBYE DEBUG] isAdmin:", isAdmin, "| isOwner:", isOwner);
    console.log("[GOODBYE DEBUG] participant:", finalParticipant);

    return isAdmin || isOwner;
  } catch (e) {
    console.error("Error verificando admin/owner:", e);
    return false;
  }
}

// ─── Evento de despedida ──────────────────────────────────────────────────────
export function setupGoodbyeEvent(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id: groupJid, participants, action } = update;

      if (!groupJid || !Array.isArray(participants) || !participants.length) return;
      if (action !== "remove" && action !== "leave") return;

      const enabled = await isGoodbyeEnabled(groupJid);
      if (!enabled) return;

      await delay(GOODBYE_DELAY);

      for (const p of participants) {
        const jidUser =
          typeof p === "string" ? p : p?.id || p?.lid || p?.phoneNumber;

        if (!jidUser) continue;

        await delay(BETWEEN_USERS_DELAY);
        await sendGoodbye(sock, groupJid, jidUser);
        console.log("👋 Goodbye enviado a:", jidUser, "en", groupJid);
      }
    } catch (e) {
      console.error("❌ Error en goodbye event:", e);
    }
  });
}

// ─── Comando .goodbye ─────────────────────────────────────────────────────────
export default {
  name: "goodbye",
  aliases: ["despedida", "bye"],
  run: async (sock, msg, args, jid, sender, isGroup) => {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando solo funciona en grupos.",
      }, { quoted: msg });
    }

    const permitido = await isAdminOrOwner(sock, jid, sender);
    if (!permitido) {
      return sock.sendMessage(jid, {
        text: "❌ Solo admins o el owner del grupo pueden usar este comando.",
      }, { quoted: msg });
    }

    const sub = (args[0] || "").toLowerCase();

    if (sub === "on") {
      await enableGoodbye(jid);
      return sock.sendMessage(jid, {
        text: "✅ *Despedida activada.*\nAhora avisaré cuando alguien salga del grupo 👋",
      }, { quoted: msg });
    }

    if (sub === "off") {
      await disableGoodbye(jid);
      return sock.sendMessage(jid, {
        text: "🔕 *Despedida desactivada.*",
      }, { quoted: msg });
    }

    // Sin argumento → mostrar estado actual
    const enabled = await isGoodbyeEnabled(jid);
    return sock.sendMessage(jid, {
      text:
        `👋 *Despedida:* ${enabled ? "✅ Activada" : "❌ Desactivada"}\n\n` +
        `• *.goodbye on* — activar\n` +
        `• *.goodbye off* — desactivar`,
    }, { quoted: msg });
  },
};