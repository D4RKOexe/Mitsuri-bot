import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "casino",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const apuesta = Number(args[0]);

    if (!apuesta || apuesta <= 0) {
      return send("❌ Uso: *.casino cantidad*");
    }

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (user.saldo < apuesta) {
      return send(
        `❌ Saldo insuficiente.\n\n👛 ${fmt(user.saldo)}`
      );
    }

    const suerte = Math.random();

    if (suerte < 0.45) {

      const premio = apuesta * 2;

      user.saldo += apuesta;

      saveDB(db);

      return send(
        `🎰 JACKPOT\n\n💰 Ganaste ${fmt(premio)}`
      );
    }

    user.saldo -= apuesta;

    saveDB(db);

    send(
      `💀 Mala suerte\n\n💸 Perdiste ${fmt(apuesta)}`
    );
  }
};