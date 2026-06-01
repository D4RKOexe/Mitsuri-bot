import { loadDB, saveDB, getUser, fmt, numId, resolverId } from "./db.js";

export default {
  name: "transferir",
  aliases: ["enviar", "pagar"],
  description: "Transferir dinero a otro usuario",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    const mentionedJid = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) return send("❌ Debes mencionar a alguien.\n\nEjemplo: `.transferir @usuario 500`");

    const cantidad = parseFloat(args[args.length - 1]);
    if (isNaN(cantidad) || cantidad <= 0) return send("❌ Indica una cantidad válida.");
    if (cantidad < 1) return send("❌ La transferencia mínima es *$1.00*");

    const db     = loadDB();
    const fromId = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const toId   = await resolverId(mentionedJid, sock, chatId);

    if (fromId === toId) return send("❌ No puedes transferirte dinero a ti mismo.");

    const from = getUser(db, fromId);
    const to   = getUser(db, toId);

    if (from.saldo < cantidad)
      return send(`❌ Saldo insuficiente.\n\n👛 Tienes: *${fmt(from.saldo)}*`);

    from.saldo -= cantidad;
    to.saldo   += cantidad;
    saveDB(db);

    await send([
      `✅ *Transferencia exitosa*`,
      ``,
      `💸 Enviaste: *${fmt(cantidad)}*`,
      `➡️ Para: +${toId}`,
      ``,
      `👛 Tu saldo: *${fmt(from.saldo)}*`,
    ].join("\n"));
  },
};