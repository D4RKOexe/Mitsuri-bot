import { loadDB, saveDB, getUser, resolverId } from "../economia/db.js";

export default {
  name: "resetmoney",
  aliases: ["resetsaldo"],

  async run(sock, msg, args, chatId, isOwner) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    if (!isOwner) {
      return send("❌ Solo el owner puede usar este comando.");
    }

    const mentionedJid =
      msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid) {
      return send(
        "❌ Uso:\n.resetmoney @usuario"
      );
    }

    const db = loadDB();

    const id = await resolverId(
      mentionedJid,
      sock,
      chatId
    );

    const user = getUser(db, id);

    user.saldo = 0;
    user.banco = 0;

    saveDB(db);

    send(
      [
        "🗑️ *DINERO RESETEADO*",
        "",
        `👤 Usuario: +${id}`,
        "💰 Billetera: $0.00",
        "🏦 Banco: $0.00"
      ].join("\n")
    );
  }
};