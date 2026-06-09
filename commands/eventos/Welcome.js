import path from "path";
import fs from "fs";
import { normalizeJid } from "../utilidades/permisos.js";
import { isWelcomeDisabled } from "./welcomeConfig.js";

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

export async function sendWelcome(sock, groupJid, jidUser) {
  if (!jidUser) return;

  try {
    const { texto } = await buildWelcomeText(sock, groupJid, jidUser);
    const rutaImagen = path.join(process.cwd(), "assets", "welcome.png");

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

      // Verifica en la base de datos si las bienvenidas están apagadas en este grupo
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

// Exportamos un objeto vacío o referencial para no romper importaciones dinámicas del handler
export default {
  name: "welcome_event",
  aliases: [],
  run: async () => {} 
};