import { loadDB, getUser, fmt, numId } from "./db.js";

export default {
  name: "balance",
  aliases: ["bal", "saldo", "perfil"],
  description: "Ver tu saldo y banco",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();

    // Puede ver el de otro usuario si lo mencionan
    const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let id, nombre;
    if (mentioned) {
      id = numId(mentioned);
      nombre = `@${id}`;
    } else {
      // Usar sender ya resuelto por el index (sin LIDs)
      id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
      nombre = msg?.pushName || `+${id}`;
    }

    const user = getUser(db, id);
    const total = user.saldo + user.banco;
    const tieneEscudo = user.inventario?.some(i => i.id === "escudo" && i.expira > Date.now());
    const tieneVip    = user.inventario?.some(i => i.id === "vip"    && i.expira > Date.now());

    await sock.sendMessage(chatId, {
      text: [
        `╔══════════════════════════╗`,
        `   💰 BALANCE — ${nombre}`,
        `╚══════════════════════════╝`,
        ``,
        `👛 *Billetera:*  ${fmt(user.saldo)}`,
        `🏦 *Banco:*      ${fmt(user.banco)}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💵 *Total:*      ${fmt(total)}`,
        ``,
        tieneEscudo ? `🛡️ Escudo activo` : "",
        tieneVip    ? `⭐ VIP activo`    : "",
      ].filter(l => l !== "").join("\n"),
    }, { quoted: msg });
  },
};