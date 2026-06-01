import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const COOLDOWN = 10 * 60 * 1000;

export default {
  name: "pescar",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const id = numId(sender);
    const user = getUser(db, id);

    const ahora = Date.now();

    if (ahora - user.lastPesca < COOLDOWN) {
      const mins = Math.ceil(
        (COOLDOWN - (ahora - user.lastPesca)) / 60000
      );

      return send(`🎣 Espera ${mins} minutos para volver a pescar.`);
    }

    const peces = [
      ["🐟 Pez común", 300],
      ["🐠 Pez raro", 1000],
      ["🦈 Tiburón", 3000],
      ["🐉 Pez legendario", 10000]
    ];

    const premio = peces[Math.floor(Math.random() * peces.length)];

    user.saldo += premio[1];
    user.lastPesca = ahora;

    saveDB(db);

    send(
      `🎣 *Pesca exitosa*\n\n${premio[0]}\n💰 Ganaste *${fmt(
        premio[1]
      )}*`
    );
  }
};