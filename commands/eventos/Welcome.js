import path from "path";
import fs from "fs";
import { normalizeJid } from "../utilidades/permisos.js";
import { isWelcomeDisabled, disableWelcome, enableWelcome } from "./welcomeConfig.js";

const WELCOME_DELAY = 5000;
const BETWEEN_USERS_DELAY = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function buildWelcomeText(sock, groupJid, jidUser) {
  let metadata = {};
  try {
    metadata = await sock.groupMetadata(groupJid);
  } catch (e) {
    console.error(e);
  }

  const groupName = metadata?.subject || "este grupo";
  const total = metadata?.participants?.length || metadata?.size || null;
  const tag = normalizeJid(jidUser);

  const texto = [
    "╭━━━〔 🌸 𝑴𝑰𝑻𝑺𝑼𝑴𝑰 𝑾𝑬𝑳𝑪𝑶𝑴𝑬 🌸 〕━━━⬣",
    `┃ 👋 ¡Holaaa, qué más @${tag}! ✨`,
    "┃ ¡Qué alegría tan grande que estés aquí! 💕",
    "┃",
    `┃ 💖 Bienvenid@ a *${groupName}*`,
    total ? `┃ 👥 ¡Ya somos *${total}* miembros en la familia!` : "┃",
    "┃",
    "┃ 🤖 Yo soy *Mitsuri Bot* y estoy lista para ayudarte.",
    "┃",
    "┃ 📜 ¡Usa el comando *.menu*",
    "┃ 🎯 para ver todas las opciones disponibles!",
    "╰━━━━━━━━━━━━━━━━━━━━⬣",
  ].join("\n");

  return { texto, metadata };
}

async function getParticipant(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];
    
    const target = normalizeJid(userJid);
    const targetRaw = target.split("@")[0];

    const participant = participants.find((p) => {
      const pId = normalizeJid(p?.id || "").split("@")[0];
      const pLid = normalizeJid(p?.lid || "").split("@")[0];
      const pPhone = String(p?.phoneNumber || "").replace(/\D/g, "");

      return (
        pId === targetRaw ||
        pLid === targetRaw ||
        (pPhone && targetRaw.includes(pPhone)) ||
        (pPhone && pPhone.includes(targetRaw))
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

    const target = normalizeJid(userJid).split("@")[0];
    const ownerJid = normalizeJid(metadata?.owner || groupJid.split("-")[0] || "").split("@")[0];
    
    let isOwner = ownerJid && (ownerJid === target || (participant?.lid && normalizeJid(participant.lid).includes(ownerJid)));

    if (target === "573223090406" || (participant?.lid && normalizeJid(participant.lid).includes("207091226669189"))) {
      isOwner = true;
    }

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

export async function sendWelcome(sock, groupJid, jidUser) {
  if (!jidUser) return;

  try {
    const { texto } = await buildWelcomeText(sock, groupJid, jidUser);
    const rutaImagen = path.join(process.cwd(), "assets", "welcome.jpg");

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

export function setupWelcomeEvent(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id: groupJid, participants, action } = update;

      if (!groupJid || !Array.isArray(participants) || !participants.length) return;
      if (action !== "add") return;

      const disabled = await isWelcomeDisabled(groupJid);
      if (disabled) return;

      await delay(WELCOME_DELAY);

      for (const p of participants) {
        const jidUser = typeof p === "string" ? p : p?.id || p?.lid || p?.phoneNumber;
        if (!jidUser) continue;

        await delay(BETWEEN_USERS_DELAY);
        await sendWelcome(sock, groupJid, jidUser);
      }
    } catch (e) {
      console.error(e);
    }
  });
}

export default {
  name: "welcome",
  aliases: ["bienvenida"],
  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    try {
      if (!isGroup) {
        return sock.sendMessage(jid, {
          text: "❌ Este comando solo funciona en grupos.",
        });
      }

      const senderStr = typeof sender === "string" ? sender : String(sender || "");
      const permitido = await isAdminOrOwner(sock, jid, senderStr);

      if (!permitido) {
        return sock.sendMessage(jid, {
          text: "❌ Solo admins o el owner del grupo pueden usar este comando.",
        });
      }

      const sub = (args[0] || "").toLowerCase();

      if (sub === "on") {
        await enableWelcome(jid);
        return sock.sendMessage(jid, {
          text: "✅ *Bienvenida activada.*",
        });
      }

      if (sub === "off") {
        await disableWelcome(jid);
        return sock.sendMessage(jid, {
          text: "🔕 *Bienvenida desactivada.*",
        });
      }

      await sendWelcome(sock, jid, senderStr);
    } catch (e) {
      console.error(e);
      await sock.sendMessage(jid, {
        text: "❌ Ocurrió un error ejecutando el comando.",
      });
    }
  },
};