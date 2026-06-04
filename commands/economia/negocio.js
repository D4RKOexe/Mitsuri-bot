import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const GANANCIAS_NEGOCIO = {
  puesto:    10000,
  tienda:    50000,
  empresa:   250000,
  fabrica:   600000,
  casino:    1500000,
  banco_neg: 3000000,
};

const EMOJI_NEGOCIO = {
  puesto:    "🥤 Puesto de Limonada",
  tienda:    "🏪 Tienda",
  empresa:   "🏢 Empresa",
  fabrica:   "🏭 Fábrica",
  casino:    "🎰 Casino",
  banco_neg: "🏦 Banco Privado",
};

const COOLDOWN = 60 * 60 * 1000;

export default {
  name: "negocio",
  aliases: ["negocios", "minegocio"],
  description: "Cobra ganancias de todos tus negocios",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    if (!user.negocios || user.negocios.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No tienes ningún negocio.\nCompra uno con *comprar puesto* (o tienda, empresa, fábrica, casino, banco).`
      }, { quoted: msg });
    }

    const ahora = Date.now();
    const diff  = ahora - (user.lastNegocio || 0);

    if (diff < COOLDOWN) {
      const resta = COOLDOWN - diff;
      const min   = Math.floor(resta / 60000);
      const seg   = Math.floor((resta % 60000) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Debes esperar *${min}m ${seg}s* para cobrar de nuevo.`
      }, { quoted: msg });
    }

    let total         = 0;
    let desglose      = "";
    let totalNegocios = 0;

    for (const negocio of user.negocios) {
      const tipo     = negocio.tipo;
      const cantidad = negocio.cantidad ?? 1;
      const porUno   = GANANCIAS_NEGOCIO[tipo] ?? 0;
      const ganancia = porUno * cantidad;
      total         += ganancia;
      totalNegocios += cantidad;
      desglose      += `${EMOJI_NEGOCIO[tipo] ?? tipo} x${cantidad} → ${fmt(ganancia)}\n`;
    }

    user.saldo       += total;
    user.lastNegocio  = ahora;
    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `🏦 *Ganancias de tus negocios*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        desglose +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 *Total negocios:* ${totalNegocios}\n` +
        `💰 *Total cobrado:* ${fmt(total)}\n` +
        `💵 *Saldo actual:* ${fmt(user.saldo)}`
    }, { quoted: msg });
  }
};