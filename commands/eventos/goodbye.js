import path from "path";
import fs from "fs";
import { normalizeJid } from "../utilidades/permisos.js";
import { isGoodbyeEnabled, enableGoodbye, disableGoodbye } from "./goodbyeConfig.js";

const GOODBYE_DELAY = 3000;
const BETWEEN_USERS_DELAY = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildGoodbyeText(sock, groupJid, jidUser) {
  let metadata = {};
  try {
    metadata = await sock.groupMetadata(groupJid);
  } catch (e) {
    console.error(e);
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

async function getParticipant(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];
    const target = normalizeJid(userJid);

    const participant = participants.find((p) => {
      return (
        normalizeJid(p?.id) === target ||
        normalizeJid(p?.lid) === target ||
        normalizeJid(p?.phoneNumber) === target
      );
    });

    return { metadata, participant };
  } catch (e) {
    console.error(e);
    return { metadata: null, participant: null };
  }
}

async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    const { metadata, participant } = await getParticipant(sock, groupJid, userJid);
    if (!metadata) return false;

    const target = normalizeJid(userJid);
    const ownerJid = normalizeJid(metadata?.owner || groupJid.split("-")[0] || "");
    
    const isOwner = ownerJid && ownerJid === target;
    const isAdmin = Boolean(
      participant?.admin === "admin" || 
      participant?.admin === "superadmin"
    );

    return isOwner || isAdmin;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function sendGoodbye(sock, groupJid, jidUser) {
  if (!jidUser) return;

  try {
    const { texto } = await buildGoodbyeText(sock, groupJid, jidUser);
    const rutaImagen = path.join(process.cwd(), "assets", "goodbye.png");

    if (fs.existsSync(rutaImagen)) {
      return await sock.sendMessage(groupJid, {
        image: { url: rutaImagen },
        caption: texto,
        mentions: [jidUser],
      });
    } else {
      return await sock.sendMessage(groupJid, {
        text: texto,
        mentions: [jidUser],
      });
    }
  } catch (e) {
    console.error(e);
  }
}

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
        const jidUser = typeof p === "string" ? p : p?.id || p?.lid || p?.phoneNumber;
        if (!jidUser) continue;

        await delay(BETWEEN_USERS_DELAY);
        await sendGoodbye(sock, groupJid, jidUser);
      }
    } catch (e) {
      console.error(e);
    }
  });
}

export default {
  name: "goodbye",
  aliases: ["despedida", "bye"],
  run: async (sock, msg, args, jid, sender, isGroup) => {
    try {
      if (!isGroup) {
        return sock.sendMessage(jid, {
          text: "❌ Este comando solo funciona en grupos.",
        }, { quoted: msg });
      }

      const senderStr = typeof sender === "string" ? sender : String(sender || "");
      const permitido = await isAdminOrOwner(sock, jid, senderStr);

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

      const enabled = await isGoodbyeEnabled(jid);
      return sock.sendMessage(jid, {
        text:
          `👋 *Despedida:* ${enabled ? "✅ Activada" : "❌ Desactivada"}\n\n` +
          `• *.goodbye on* — activar\n` +
          `• *.goodbye off* — desactivar`,
      }, { quoted: msg });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(jid, {
        text: "❌ Ocurrió un error ejecutando el comando.",
      }, { quoted: msg });
    }
  },
};