import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const COOLDOWN = 24 * 60 * 60 * 1000; // 24 horas
const BASE_REWARD = 200;

export default {
  name: "daily",
  aliases: ["diario", "recompensa"],
  description: "Reclama tu recompensa diaria",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    const ahora = Date.now();
    const diff = ahora - (user.lastDaily || 0);

    if (diff < COOLDOWN) {
      const restante = COOLDOWN - diff;
      const h = Math.floor(restante / 3600000);
      const m = Math.floor((restante % 3600000) / 60000);
      return sock.sendMessage(chatId, {
        text: `⏳ Ya reclamaste tu daily.\n\n⏱️ Vuelve en *${h}h ${m}m*`,
      }, { quoted: msg });
    }

    // VIP = doble recompensa
    const tieneVip = user.inventario?.some(i => i.id === "vip" && i.expira > ahora);
    const reward = tieneVip ? BASE_REWARD * 2 : BASE_REWARD;

    user.saldo += reward;
    user.lastDaily = ahora;
    saveDB(db);

    await sock.sendMessage(chatId, {
      text: [
        `🎁 *¡Daily reclamado!*`,
        ``,
        `💵 Recibiste: *${fmt(reward)}*${tieneVip ? " ⭐ (VIP x2)" : ""}`,
        `👛 Saldo actual: *${fmt(user.saldo)}*`,
        ``,
        `⏰ Vuelve mañana para reclamar de nuevo.`,
      ].join("\n"),
    }, { quoted: msg });
  },
};