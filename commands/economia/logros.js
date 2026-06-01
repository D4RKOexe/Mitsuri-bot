import { loadDB, getUser, numId } from "./db.js";

export default {
  name: "logros",
  aliases: ["achievements"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const user = getUser(db, numId(sender));

    const e = user.estadisticas || {};

    const logros = [];

    if ((e.trabajos || 0) >= 1)
      logros.push("🏆 Primer trabajo");

    if ((e.trabajos || 0) >= 10)
      logros.push("💼 Trabajador constante");

    if ((e.trabajos || 0) >= 50)
      logros.push("👨‍💼 Magnate laboral");

    if ((e.robos || 0) >= 1)
      logros.push("🦹 Primer robo");

    if ((e.robos || 0) >= 10)
      logros.push("🏴‍☠️ Ladrón profesional");

    if ((e.robos || 0) >= 50)
      logros.push("👑 Rey del crimen");

    if ((e.pesca || 0) >= 10)
      logros.push("🎣 Pescador experto");

    if ((e.pesca || 0) >= 50)
      logros.push("🐟 Maestro pescador");

    if ((e.mineria || 0) >= 10)
      logros.push("⛏️ Minero experto");

    if ((e.mineria || 0) >= 50)
      logros.push("💎 Señor de las minas");

    if (user.saldo >= 100000)
      logros.push("💰 Primeros 100K");

    if (user.saldo >= 1000000)
      logros.push("🏦 Millonario");

    if (user.saldo >= 10000000)
      logros.push("👑 Multimillonario");

    if (logros.length === 0) {
      return send(
        "😢 Aún no has desbloqueado logros.\n\n¡Sigue jugando!"
      );
    }

    send(
      [
        "🏆 *TUS LOGROS*",
        "",
        ...logros.map(x => `• ${x}`)
      ].join("\n")
    );
  }
};