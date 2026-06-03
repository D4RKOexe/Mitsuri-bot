import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const COOLDOWN = 15 * 60 * 1000;

export default {
  name: "minar",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const id = numId(sender);
    const user = getUser(db, id);

    const ahora = Date.now();

    if (ahora - user.lastMina < COOLDOWN) {
      const mins = Math.ceil(
        (COOLDOWN - (ahora - user.lastMina)) / 60000
      );

      return send(`⛏️ Espera ${mins} minutos para volver a minar.`);
    }

    const minerales = [
      ["🪨 Carbón", 500],
      ["⛓️ Hierro", 1500],
      ["🥇 Oro", 4000],
      ["💎 Diamante", 12000]
    ];

    const premio =
      minerales[Math.floor(Math.random() * minerales.length)];

    user.saldo += premio[1];
user.lastMina = ahora;

// Estadísticas
user.estadisticas ??= {};
user.estadisticas.mineria ??= 0;
user.estadisticas.mineria++;

saveDB(db);

    send(
      `⛏️ *Minería completada*\n\n${premio[0]}\n💰 Ganaste *${fmt(
        premio[1]
      )}*`
    );
  }
};