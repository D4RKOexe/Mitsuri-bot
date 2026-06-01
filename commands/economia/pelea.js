import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "pelea",
  aliases: ["fight"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const apuesta = Number(args[0]);

    if (!apuesta || apuesta <= 0) {
      return send("❌ Uso: *.pelea cantidad*");
    }

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (user.saldo < apuesta) {
      return send(
        `❌ No tienes suficiente dinero.\n\n👛 Saldo: ${fmt(user.saldo)}`
      );
    }

    const jugador = Math.floor(Math.random() * 100) + 1;
    const bot = Math.floor(Math.random() * 100) + 1;

    let texto =
      `⚔️ *PELEA*\n\n` +
      `🧑 Tú: *${jugador} HP*\n` +
      `🤖 Bot: *${bot} HP*\n\n`;

    if (jugador > bot) {

      const premio = apuesta * 2;

      user.saldo += apuesta;

      texto +=
        `🏆 ¡Ganaste la pelea!\n` +
        `💰 Premio: ${fmt(premio)}`;

    } else if (jugador < bot) {

      user.saldo -= apuesta;

      texto +=
        `💀 Perdiste la pelea.\n` +
        `💸 Perdiste: ${fmt(apuesta)}`;

    } else {

      texto +=
        `🤝 Empate.\n` +
        `No ganas ni pierdes dinero.`;
    }

    saveDB(db);

    send(texto);
  }
};