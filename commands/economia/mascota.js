import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const GANANCIAS_MASCOTA = {
  perro:  5000,
  gato:   10000,
  zorro:  25000,
  dragon: 100000
};

const EMOJI_MASCOTA = {
  perro:  "🐕 Perro",
  gato:   "🐈 Gato",
  zorro:  "🦊 Zorro",
  dragon: "🐉 Dragón"
};

const COOLDOWN = 60 * 60 * 1000; // 1 hora

export default {
  name: "mascota",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    if (!user.mascotas || user.mascotas.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No tienes ninguna mascota.\nCompra una con *comprar perro* (o gato, zorro, dragón).`
      });
    }

    const ahora = Date.now();
    const diff  = ahora - (user.lastMascota || 0);

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

    for (const mascota of user.mascotas) {
      const tipo     = typeof mascota === "string" ? mascota : mascota.tipo;
      const ganancia = GANANCIAS_MASCOTA[tipo] ?? 0;
      total         += ganancia;
      desglose      += `${EMOJI_MASCOTA[tipo] ?? tipo} → ${fmt(ganancia)}\n`;
    }

    user.saldo      += total;
    user.lastMascota = ahora;
    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `🐾 *Ganancias de tus mascotas*\n\n` +
        desglose +
        `\n💰 *Total cobrado:* ${fmt(total)}\n` +
        `💵 *Saldo actual:* ${fmt(user.saldo)}`
    });
  }
};