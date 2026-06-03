import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const GANANCIAS_NEGOCIO = {
  puesto:  10000,
  tienda:  50000,
  empresa: 250000
};

const EMOJI_NEGOCIO = {
  puesto:  "🥤 Puesto de Limonada",
  tienda:  "🏪 Tienda",
  empresa: "🏢 Empresa"
};

const COOLDOWN = 60 * 60 * 1000; // 1 hora

export default {
  name: "negocio",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    if (!user.negocios || user.negocios.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No tienes ningún negocio.\nCompra uno con *comprar puesto* (o tienda, empresa).`
      });
    }

    const ahora = Date.now();
    const diff  = ahora - (user.lastNegocio || 0);

    if (diff < COOLDOWN) {
      const resta = COOLDOWN - diff;
      const min   = Math.floor(resta / 60000);
      const seg   = Math.floor((resta % 60000) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Debes esperar *${min}m ${seg}s* para cobrar de nuevo.`
      });
    }

    let total    = 0;
    let desglose = "";

    for (const negocio of user.negocios) {
      const tipo     = typeof negocio === "string" ? negocio : negocio.tipo;
      const ganancia = GANANCIAS_NEGOCIO[tipo] ?? 0;
      total         += ganancia;
      desglose      += `${EMOJI_NEGOCIO[tipo] ?? tipo} → ${fmt(ganancia)}\n`;
    }

    user.saldo       += total;
    user.lastNegocio  = ahora;
    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `🏦 *Ganancias de tus negocios*\n\n` +
        desglose +
        `\n💰 *Total cobrado:* ${fmt(total)}\n` +
        `💵 *Saldo actual:* ${fmt(user.saldo)}`
    });
  }
};