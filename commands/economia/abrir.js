import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "abrir",
  aliases: ["open"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    if (!args[0]) {
      return send(
        "📦 Usa:\n\n" +
        "*.abrir cajacomun*\n" +
        "*.abrir cajarara*\n" +
        "*.abrir cajalegendaria*"
      );
    }

    const caja = args[0].toLowerCase();

    const db = loadDB();
    const id = numId(sender || msg.key.remoteJid);
    const user = getUser(db, id);

    const index = user.inventario.findIndex(
      i => i.id === caja
    );

    if (index === -1) {
      return send("❌ No tienes esa caja.");
    }

    let premio = 0;
    let texto = "";

    if (caja === "cajacomun") {
      const premios = [5000, 10000, 15000, 20000];

      premio =
        premios[Math.floor(Math.random() * premios.length)];

      texto = `📦 Caja Común`;
    }

    else if (caja === "cajarara") {
      const premios = [50000, 75000, 100000, 150000];

      premio =
        premios[Math.floor(Math.random() * premios.length)];

      texto = `🎁 Caja Rara`;
    }

    else if (caja === "cajalegendaria") {
      const premios = [250000, 500000, 750000, 1000000];

      premio =
        premios[Math.floor(Math.random() * premios.length)];

      texto = `💎 Caja Legendaria`;
    }

    user.saldo += premio;

    user.inventario.splice(index, 1);

    saveDB(db);

    await send(
      [
        texto,
        "",
        `🎉 Premio obtenido: *${fmt(premio)}*`,
        `👛 Nuevo saldo: *${fmt(user.saldo)}*`
      ].join("\n")
    );
  }
};