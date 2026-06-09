import { normalizeJid } from "../utilidades/permisos.js";
import { isWelcomeDisabled, disableWelcome, enableWelcome } from "./welcomeConfig.js";

const WELCOME_DELAY = 5000;
const BETWEEN_USERS_DELAY = 1200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// ─── Buscar participante usando tu normalizador estándar ─────────────────────
async function getParticipant(sock, groupJid, userJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];
    
    const target = normalizeJid(userJid);

    // Buscamos cruzando de forma limpia usando tu función centralizada
    const participant = participants.find((p) => {
      return (
        normalizeJid(p?.id) === target ||
        normalizeJid(p?.lid) === target ||
        normalizeJid(p?.phoneNumber) === target
      );
    });

    return { metadata, participant };
  } catch (e) {
    console.error("Error obteniendo participante:", e);
    return { metadata: null, participant: null };
  }
}

// ─── Verificar admin/owner sin perder compatibilidad LID ──────────────────────
async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    const { metadata, participant } = await getParticipant(sock, groupJid, userJid);
    if (!metadata) return false;

    const target = normalizeJid(userJid);
    const ownerJid = normalizeJid(metadata?.owner || groupJid.split("-")[0] || "");
    
    // Si coincide el creador directamente
    const isOwner = ownerJid && ownerJid === target;

    // Estructura oficial de privilegios de Baileys
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

// Los métodos sendWelcome, setupWelcomeEvent y el comando por defecto se quedan igual...