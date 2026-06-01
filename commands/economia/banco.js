import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "banco",
  aliases: ["bank"],
  description: "Deposita, retira o consulta tu banco",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    const sub = args[0]?.toLowerCase();
    const cantidad = parseFloat(args[1]);

    if (!sub || sub === "balance" || sub === "bal") {
      return send([
        `╔══════════════════════════╗`,
        `   🏦 BANCO DE ${id}`,
        `╚══════════════════════════╝`,
        ``,
        `👛 *Billetera:*  ${fmt(user.saldo)}`,
        `🏦 *Banco:*      ${fmt(user.banco)}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💵 *Total:*      ${fmt(user.saldo + user.banco)}`,
        ``,
        `Usa:`,
        `• *.banco depositar <cantidad>*`,
        `• *.banco retirar <cantidad>*`,
      ].join("\n"));
    }

    if (sub === "depositar" || sub === "dep" || sub === "deposit") {
      if (isNaN(cantidad) || cantidad <= 0)
        return send("❌ Indica cuánto depositar.\n\nEjemplo: `.banco depositar 500`");
      if (cantidad > user.saldo)
        return send(`❌ No tienes suficiente en tu billetera.\n\n👛 Billetera: *${fmt(user.saldo)}*`);

      user.saldo -= cantidad;
      user.banco += cantidad;
      saveDB(db);

      return send([
        `🏦 *Depósito exitoso*`,
        ``,
        `💰 Depositaste: *${fmt(cantidad)}*`,
        `👛 Billetera: *${fmt(user.saldo)}*`,
        `🏦 Banco:     *${fmt(user.banco)}*`,
      ].join("\n"));
    }

    if (sub === "retirar" || sub === "ret" || sub === "withdraw") {
      if (isNaN(cantidad) || cantidad <= 0)
        return send("❌ Indica cuánto retirar.\n\nEjemplo: `.banco retirar 500`");
      if (cantidad > user.banco)
        return send(`❌ No tienes suficiente en el banco.\n\n🏦 Banco: *${fmt(user.banco)}*`);

      user.banco -= cantidad;
      user.saldo += cantidad;
      saveDB(db);

      return send([
        `🏦 *Retiro exitoso*`,
        ``,
        `💰 Retiraste: *${fmt(cantidad)}*`,
        `👛 Billetera: *${fmt(user.saldo)}*`,
        `🏦 Banco:     *${fmt(user.banco)}*`,
      ].join("\n"));
    }

    return send(`❌ Subcomando no reconocido.\n\nUsa: *.banco depositar* | *.banco retirar* | *.banco balance*`);
  },
};