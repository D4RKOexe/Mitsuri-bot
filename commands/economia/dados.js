import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "dados",
  aliases: ["dice"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const apuesta = Number(args[0]);

    if (!apuesta || apuesta <= 0) {
      return send("❌ Uso: *.dados cantidad*");
    }

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (user.saldo < apuesta) {
      return send(
        `❌ No tienes suficiente dinero.\n\n👛 Saldo: *${fmt(user.saldo)}*`
      );
    }

    const jugador = Math.floor(Math.random() * 6) + 1;
    const bot = Math.floor(Math.random() * 6) + 1;

    let texto =
      `🎲 *BATALLA DE DADOS*\n\n` +
      `👤 Tú: *${jugador}*\n` +
      `🤖 Bot: *${bot}*\n\n`;

    if (jugador > bot) {
      user.saldo += apuesta;

      texto += `🎉 ¡Ganaste!\n💰 Premio: *${fmt(apuesta)}*`;
    }

    else if (jugador < bot) {
      user.saldo -= apuesta;

      texto += `💀 Perdiste.\n💸 Perdiste: *${fmt(apuesta)}*`;
    }

    else {
      texto += `🤝 Empate.\nNo ganas ni pierdes dinero.`;
    }

    saveDB(db);

    send(texto);
  }
};