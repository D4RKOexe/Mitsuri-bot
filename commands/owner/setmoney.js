import { loadDB, saveDB, getUser, resolverId, fmt } from "../economia/db.js";

export default {
  name: "setmoney",

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
        "❌ Uso:\n.setmoney @usuario 50000"
      );
    }

    const cantidad = Number(args[args.length - 1]);

    if (
      !Number.isFinite(cantidad) ||
      cantidad < 0
    ) {
      return send("❌ Cantidad inválida.");
    }

    const db = loadDB();

    const id = await resolverId(
      mentionedJid,
      sock,
      chatId
    );

    const user = getUser(db, id);

    user.saldo = cantidad;

    saveDB(db);

    send(
      [
        "💰 *SALDO MODIFICADO*",
        "",
        `👤 Usuario: +${id}`,
        `💵 Nuevo saldo: ${fmt(user.saldo)}`
      ].join("\n")
    );
  }
};