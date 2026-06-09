import { normalizeJid } from "../utilidades/permisos.js";
import { isWelcomeDisabled, disableWelcome, enableWelcome } from "./welcomeConfig.js";

const WELCOME_DELAY = 5000;
const BETWEEN_USERS_DELAY = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Modificado para limpiar de forma segura manteniendo una consistencia en las comparaciones
function cleanJid(jid = "") {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].trim();
}

// ─── Construir texto de bienvenida ────────────────────────────────────────────
async function buildWelcomeText(sock, groupJid, jidUser) {
  let metadata = {};
  try {
    metadata = await sock.groupMetadata(groupJid);
  } catch (e) {
    console.error("No pude obtener metadata del grupo:", e);
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

// ─── Buscar participante por JID de forma robusta ─────────────────────────────
async function getParticipant(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];
    const target = cleanJid(userJid);

    const participant = participants.find((p) => {
      return (
        cleanJid(p?.id) === target ||
        cleanJid(p?.lid) === target ||
        cleanJid(p?.phoneNumber) === target
      );
    });

    return { metadata, participant };
  } catch (e) {
    console.error("Error obteniendo participante:", e);
    return { metadata: null, participant: null };
  }
}

// ─── Verificar admin/owner ────────────────────────────────────────────────────
async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    const userJidStr = typeof userJid === "string" ? userJid : String(userJid || "");
    const { metadata, participant } = await getParticipant(sock, groupJid, userJidStr);
    if (!metadata) return false;

    const userClean = cleanJid(userJidStr);
    
    // El creador/owner puede venir en metadata.owner o a veces en el jid del grupo (ej: 57xxxx-creator@g.us)
    const ownerJid = cleanJid(metadata?.owner || groupJid.split("-")[0] || "");
    const isOwner = ownerJid && ownerJid === userClean;

    // Baileys usa p.admin === 'admin' o 'superadmin'
    const isAdmin = Boolean(
      participant?.admin === "admin" || 
      participant?.admin === "superadmin"
    );

    return isOwner || isAdmin;
  } catch (e) {
    console.error("Error verificando admin/owner:", e);
    return false;
  }
}

// ─── Enviar bienvenida ────────────────────────────────────────────────────────
export async function sendWelcome(sock, groupJid, jidUser) {
  if (!jidUser) return;

  try {
    const { texto } = await buildWelcomeText(sock, groupJid, jidUser);

    return await sock.sendMessage(groupJid, {
      text: texto,
      mentions: [jidUser],
    });
  } catch (e) {
    console.error("Error enviando bienvenida:", e);
  }
}

// ─── Evento de bienvenida con delay ───────────────────────────────────────────
export function setupWelcomeEvent(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      console.log("📥 group-participants.update:", JSON.stringify(update, null, 2));

      const { id: groupJid, participants, action } = update;

      if (!groupJid || !Array.isArray(participants) || !participants.length) {
        console.log("⚠️ update inválido");
        return;
      }

      if (action !== "add") {
        console.log("⏭️ acción ignorada:", action);
        return;
      }

      const disabled = await isWelcomeDisabled(groupJid);
      console.log("🔧 welcome desactivado en grupo?", disabled, "grupo:", groupJid);

      if (disabled) return;

      await delay(WELCOME_DELAY);

      for (const p of participants) {
        const jidUser =
          typeof p === "string"
            ? p
            : p?.id || p?.lid || p?.phoneNumber;

        console.log("👤 participante detectado:", p, "=>", jidUser);

        if (!jidUser) continue;

        await delay(BETWEEN_USERS_DELAY);
        await sendWelcome(sock, groupJid, jidUser);
        console.log("✅ welcome enviado a:", jidUser, "en", groupJid);
      }
    } catch (e) {
      console.error("❌ Error en welcome event:", e);
    }
  });
}

// ─── Comando .testwelcome ─────────────────────────────────────────────────────
export default {
  name: "testwelcome",
  run: async (sock, msg, args, jid, sender, isGroup) => {
    try {
      if (!isGroup) {
        return sock.sendMessage(jid, {
          text: "❌ Este comando solo funciona en grupos.",
        });
      }

      const senderStr = typeof sender === "string" ? sender : String(sender || "");
      const permitido = await isAdminOrOwner(sock, jid, senderStr);

      if (!permitido) {
        const { metadata, participant } = await getParticipant(sock, jid, senderStr);

        console.log("sender:", senderStr);
        console.log("sender limpio:", cleanJid(senderStr));
        console.log("owner:", metadata?.owner);
        console.log("participant encontrado:", participant);

        return sock.sendMessage(jid, {
          text: "❌ Solo admins o el owner del grupo pueden usar este comando.",
        });
      }

      await sendWelcome(sock, jid, senderStr);
    } catch (e) {
      console.error("Error en comando testwelcome:", e);
      await sock.sendMessage(jid, {
        text: "❌ Ocurrió un error ejecutando testwelcome.",
      });
    }
  },
};