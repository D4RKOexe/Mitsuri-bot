import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const GANANCIAS_MASCOTA = {
  perro:    5000,
  gato:     10000,
  zorro:    25000,
  dragon:   100000,
  unicornio:200000,
  fenix:    500000,
};

const EMOJI_MASCOTA = {
  perro:    "🐕 Perro",
  gato:     "🐈 Gato",
  zorro:    "🦊 Zorro",
  dragon:   "🐉 Dragón",
  unicornio:"🦄 Unicornio",
  fenix:    "🔥 Fénix",
};

const COOLDOWN = 60 * 60 * 1000;

export default {
  name: "mascota",
  aliases: ["mascotas", "mismascota"],
  description: "Cobra ganancias de todas tus mascotas",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    if (!user.mascotas || user.mascotas.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No tienes ninguna mascota.\nCompra una con *comprar perro* (o gato, zorro, dragón, unicornio, fénix).`
      }, { quoted: msg });
    }

    const ahora = Date.now();
    const diff  = ahora - (user.lastMascota || 0);

    if (diff < COOLDOWN) {
      const resta = COOLDOWN - diff;
      const min   = Math.floor(resta / 60000);
      const seg   = Math.floor((resta % 60000) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ Debes esperar *${min}m ${seg}s* para cobrar de nuevo.`
      }, { quoted: msg });
    }

    let total    = 0;
    let desglose = "";
    let totalMascotas = 0;

    for (const mascota of user.mascotas) {
      const tipo     = mascota.tipo;
      const cantidad = mascota.cantidad ?? 1;
      const porUno   = GANANCIAS_MASCOTA[tipo] ?? 0;
      const ganancia = porUno * cantidad;
      total         += ganancia;
      totalMascotas += cantidad;
      desglose      += `${EMOJI_MASCOTA[tipo] ?? tipo} x${cantidad} → ${fmt(ganancia)}\n`;
    }

    user.saldo      += total;
    user.lastMascota = ahora;
    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `🐾 *Ganancias de tus mascotas*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        desglose +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🐾 *Total mascotas:* ${totalMascotas}\n` +
        `💰 *Total cobrado:* ${fmt(total)}\n` +
        `💵 *Saldo actual:* ${fmt(user.saldo)}`
    }, { quoted: msg });
  }
};