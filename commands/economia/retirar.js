import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const TIEMPO = 60 * 60 * 1000;

export default {
  name: "retirar",
  aliases: ["claiminv"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (!user.inversion) {
      return send("❌ No tienes inversiones activas.");
    }

    const tiempoPasado = Date.now() - user.inversion.inicio;

    if (tiempoPasado < TIEMPO) {
      const mins = Math.ceil((TIEMPO - tiempoPasado) / 60000);

      return send(
        `⏳ Tu inversión sigue creciendo.\n\nFaltan *${mins} minutos*.`
      );
    }

    const multiplicador = 0.8 + Math.random();

    const recompensa = Math.floor(
      user.inversion.cantidad * multiplicador
    );

    user.saldo += recompensa;

    const invertido = user.inversion.cantidad;

    user.inversion = null;

    saveDB(db);

    send(
      [
        `💎 *Inversión finalizada*`,
        ``,
        `📈 Invertido: *${fmt(invertido)}*`,
        `💰 Recibido: *${fmt(recompensa)}*`,
        `👛 Saldo actual: *${fmt(user.saldo)}*`
      ].join("\n")
    );
  }
};