import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const COOLDOWN = 60 * 60 * 1000;

export default {
  name: "cofre",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const id = numId(sender);
    const user = getUser(db, id);

    const ahora = Date.now();

    if (ahora - user.lastCofre < COOLDOWN) {
      const mins = Math.ceil(
        (COOLDOWN - (ahora - user.lastCofre)) / 60000
      );

      return send(`🎁 Espera ${mins} minutos para abrir otro cofre.`);
    }

    user.lastCofre = ahora;

    if (Math.random() < 0.25) {
      saveDB(db);
      return send("📦 Abriste el cofre...\n\n😢 Estaba vacío.");
    }

    const premio = Math.floor(Math.random() * 15000) + 1000;

    user.saldo += premio;

    saveDB(db);

    send(
      `🎁 *Cofre abierto*\n\n💰 Encontraste *${fmt(
        premio
      )}* dentro.`
    );
  }
};