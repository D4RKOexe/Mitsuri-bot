import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const TIEMPO = 60 * 60 * 1000; // 1 hora

export default {
  name: "invertir",
  aliases: ["inv"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const cantidad = Number(args[0]);

    if (!cantidad || cantidad <= 0) {
      return send("❌ Uso: *.invertir cantidad*");
    }

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (user.inversion) {
      return send("❌ Ya tienes una inversión activa.\n\nUsa *.retirar* cuando termine.");
    }

    if (user.saldo < cantidad) {
      return send(
        `❌ No tienes suficiente dinero.\n\n👛 Saldo: *${fmt(user.saldo)}*`
      );
    }

    user.saldo -= cantidad;

    user.inversion = {
      cantidad,
      inicio: Date.now()
    };

    saveDB(db);

    send(
      `💎 *Inversión realizada*\n\n💵 Invertiste: *${fmt(cantidad)}*\n⏳ Tiempo: *1 hora*\n\nUsa *.retirar* cuando termine.`
    );
  }
};