import {
  loadDB,
  saveDB,
  getUser,
  fmt,
  numId
} from "./db.js";

const PRECIO = 1000;

export default {
  name: "loteria",
  aliases: ["lotto"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const cantidad = parseInt(args[0]);

    if (!cantidad || cantidad < 1) {
      return send(
        "🎫 Uso:\n\n.loteria 5"
      );
    }

    const db = loadDB();

    const user = getUser(
      db,
      numId(sender)
    );

    const costo = cantidad * PRECIO;

    if (user.saldo < costo) {
      return send(
        `❌ No tienes suficiente dinero.\n\n💰 Necesitas ${fmt(costo)}`
      );
    }

    user.saldo -= costo;

    for (let i = 0; i < cantidad; i++) {
      db.loteria.participantes.push(
        numId(sender)
      );
    }

    db.loteria.pozo += costo;

    saveDB(db);

    send(
      [
        "🎫 *LOTERÍA*",
        "",
        `Boletos: *${cantidad}*`,
        `💸 Gastaste: *${fmt(costo)}*`,
        `🏆 Pozo actual: *${fmt(db.loteria.pozo)}*`
      ].join("\n")
    );
  }
};