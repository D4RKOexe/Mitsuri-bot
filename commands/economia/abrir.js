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

  const roll = Math.random();

  if (roll < 0.40) {
    premio = 5000; // 40%
  }

  else if (roll < 0.70) {
    premio = 10000; // 30%
  }

  else if (roll < 0.90) {
    premio = 15000; // 20%
  }

  else {
    premio = 25000; // 10%
  }

  texto = "📦 Caja Común";
}

else if (caja === "cajarara") {

  const roll = Math.random();

  if (roll < 0.40) {
    premio = 20000; // 40%
  }

  else if (roll < 0.70) {
    premio = 40000; // 30%
  }

  else if (roll < 0.90) {
    premio = 75000; // 20%
  }

  else {
    premio = 150000; // 10%
  }

  texto = "🎁 Caja Rara";
}

else if (caja === "cajalegendaria") {

  const roll = Math.random();

  if (roll < 0.40) {
    premio = 100000; // 40%
  }

  else if (roll < 0.70) {
    premio = 150000; // 30%
  }

  else if (roll < 0.85) {
    premio = 250000; // 15%
  }

  else if (roll < 0.95) {
    premio = 300000; // 10%
  }

  else if (roll < 0.99) {
    premio = 500000; // 4%
  }

  else {
    premio = 1000000; // 1%
  }

  texto = "💎 Caja Legendaria";
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