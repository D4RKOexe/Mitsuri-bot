import { loadDB, saveDB } from "../economia/db.js";

export default {
  name: "reseteco",

  async run(sock, msg, args, chatId, isOwner) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    if (!isOwner) {
      return send("❌ Solo el owner puede usar este comando.");
    }

    const db = loadDB();

    db.usuarios = {};

    if (db.loteria) {
      db.loteria.pozo = 0;
      db.loteria.participantes = [];
    }

    saveDB(db);

    send(
      "☢️ *Economía reseteada completamente.*\n\nTodos los saldos fueron eliminados."
    );
  }
};