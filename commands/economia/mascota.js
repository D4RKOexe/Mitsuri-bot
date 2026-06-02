import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const MASCOTAS = {
  perro: {
    nombre: "🐕 Perro",
    ganancia: 5000
  },
  gato: {
    nombre: "🐈 Gato",
    ganancia: 10000
  },
  zorro: {
    nombre: "🦊 Zorro",
    ganancia: 25000
  },
  dragon: {
    nombre: "🐉 Dragón",
    ganancia: 100000
  }
};

export default {
  name: "mascota",
  aliases: ["pet", "cobrarmascota"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();

    const id = numId(
      sender ||
      msg?.key?.participant ||
      msg?.key?.remoteJid
    );

    const user = getUser(db, id);

    if (!user.mascota) {
      return sock.sendMessage(chatId, {
        text:
          "❌ No tienes mascota.\n\n" +
          "Compra una en *.tienda*"
      }, { quoted: msg });
    }

    const mascota = MASCOTAS[user.mascota.tipo];

    if (!mascota) {
      return sock.sendMessage(chatId, {
        text: "❌ Mascota inválida."
      }, { quoted: msg });
    }

    const ahora = Date.now();

    const cooldown = 60 * 60 * 1000; // 1 hora

    const tiempoRestante =
      cooldown - (ahora - (user.lastMascota || 0));

    if (tiempoRestante > 0) {
      const minutos = Math.ceil(
        tiempoRestante / 60000
      );

      return sock.sendMessage(chatId, {
        text:
          `${mascota.nombre}\n\n` +
          `⏳ Debes esperar *${minutos} minutos* para volver a cobrar.`
      }, { quoted: msg });
    }

    user.saldo += mascota.ganancia;
    user.lastMascota = ahora;

    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `${mascota.nombre}\n\n` +
        `💰 Tu mascota encontró *${fmt(mascota.ganancia)}*\n\n` +
        `👛 Saldo actual: *${fmt(user.saldo)}*`
    }, { quoted: msg });
  }
};