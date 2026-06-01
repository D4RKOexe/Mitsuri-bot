import {
  loadDB,
  saveDB,
  getUser,
  fmt,
  numId,
  resolverId
} from "./db.js";

const COOLDOWN = 2 * 60 * 60 * 1000;
const PROB_EXITO = 0.35;
const MULTA = 0.50;

export default {
  name: "atracar",
  aliases: ["asalto"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const mentionedJid =
      msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      return send(
        "❌ Menciona a quién quieres atracar.\n\nEjemplo: *.atracar @usuario*"
      );
    }

    const db = loadDB();

    const fromId = numId(sender);
    const toId = await resolverId(
      mentionedJid,
      sock,
      chatId
    );

    if (fromId === toId) {
      return send("❌ No puedes atracarte a ti mismo.");
    }

    const ladron = getUser(db, fromId);
    const victima = getUser(db, toId);

    const ahora = Date.now();

    const diff =
      ahora - (ladron.lastAtraco || 0);

    if (diff < COOLDOWN) {

      const mins = Math.ceil(
        (COOLDOWN - diff) / 60000
      );

      return send(
        `⏳ La policía te está buscando.\n\nEspera *${mins} minutos*.`
      );
    }

    if (victima.saldo < 1000) {
      return send(
        `😂 Ese usuario está más pobre que tú.`
      );
    }

    ladron.lastAtraco = ahora;

    if (Math.random() < PROB_EXITO) {

      const robado = Math.max(
        1,
        Math.floor(
          victima.saldo *
          (0.25 + Math.random() * 0.15)
        )
      );

      victima.saldo -= robado;
      ladron.saldo += robado;

      if (ladron.estadisticas) {
        ladron.estadisticas.robos++;
      }

      saveDB(db);

      return send(
        [
          "🏴‍☠️ *ATRACO EXITOSO*",
          "",
          `💰 Robaste *${fmt(robado)}*`,
          `👛 Saldo actual: *${fmt(ladron.saldo)}*`
        ].join("\n")
      );
    }

    const multa = Math.max(
      1,
      Math.floor(ladron.saldo * MULTA)
    );

    ladron.saldo = Math.max(
      0,
      ladron.saldo - multa
    );

    saveDB(db);

    return send(
      [
        "🚔 *ATRACO FALLIDO*",
        "",
        `💸 Multa: *${fmt(multa)}*`,
        `👛 Saldo actual: *${fmt(ladron.saldo)}*`
      ].join("\n")
    );
  }
};