import { loadDB, saveDB, getUser, fmt, numId, resolverId } from "./db.js";

export default {
  name: "dardinero",
  aliases: ["quitardinero", "reseteco"],
  superOwnerOnly: true,
  description: "Comandos admin de economía",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    const bodyRaw = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "";
    const cmd     = bodyRaw.trim().split(/\s+/)[0]?.replace(/^\./, "").toLowerCase();
    const db      = loadDB();

    if (cmd === "reseteco") {
      db.usuarios = {};
      saveDB(db);
      return send("🗑️ *Economía reseteada completamente.*");
    }

    const mentionedJid = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) return send("❌ Menciona a un usuario.\n\nEj: `.dardinero @usuario 1000`");

    const toId    = await resolverId(mentionedJid, sock, chatId);
    const user    = getUser(db, toId);
    const cantidad = parseFloat(args[args.length - 1]);

    if (isNaN(cantidad) || cantidad <= 0) return send("❌ Indica una cantidad válida.");

    if (cmd === "dardinero") {
      user.saldo += cantidad;
      saveDB(db);
      return send([
        `✅ *Dinero otorgado*`,
        ``,
        `👤 Usuario: +${toId}`,
        `💵 Monto: *+${fmt(cantidad)}*`,
        `👛 Nuevo saldo: *${fmt(user.saldo)}*`,
      ].join("\n"));
    }

    if (cmd === "quitardinero") {
      user.saldo = Math.max(0, user.saldo - cantidad);
      saveDB(db);
      return send([
        `✅ *Dinero quitado*`,
        ``,
        `👤 Usuario: +${toId}`,
        `💸 Monto: *-${fmt(cantidad)}*`,
        `👛 Nuevo saldo: *${fmt(user.saldo)}*`,
      ].join("\n"));
    }

    return send("❌ Comando no reconocido.");
  },
};