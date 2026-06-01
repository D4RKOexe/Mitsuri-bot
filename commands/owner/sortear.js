import {
  loadDB,
  saveDB,
  fmt
} from "../economia/db.js";

export default {
  name: "sortear",

  async run(sock, msg, args, chatId) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();

    if (
      !db.loteria ||
      db.loteria.participantes.length === 0
    ) {
      return send(
        "❌ No hay participantes."
      );
    }

    const ganador =
      db.loteria.participantes[
        Math.floor(
          Math.random() *
          db.loteria.participantes.length
        )
      ];

    const premio = db.loteria.pozo;

    if (db.usuarios[ganador]) {
      db.usuarios[ganador].saldo += premio;
    }

    db.loteria.pozo = 0;
    db.loteria.participantes = [];

    saveDB(db);

    send(
      [
        "🎉 *SORTEO FINALIZADO*",
        "",
        `🏆 Ganador: ${ganador}`,
        `💰 Premio: ${fmt(premio)}`
      ].join("\n")
    );
  }
};