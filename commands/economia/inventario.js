import { loadDB, getUser, fmt, numId, TIENDA } from "./db.js";

export default {
  name: "inventario",
  aliases: ["inv", "mochila", "items"],
  description: "Ver tus items activos",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    const ahora = Date.now();
    const items = (user.inventario || []).filter(i => {
      if (i.expira) return i.expira > ahora;
      if (i.usos !== undefined) return i.usos > 0;
      return true;
    });

    if (items.length === 0) {
      return sock.sendMessage(chatId, {
        text: `🎒 Tu inventario está vacío.\n\nCompra items con *.tienda*`,
      }, { quoted: msg });
    }

    const lista = items.map(i => {
      const info = TIENDA.find(t => t.id === i.id);
      const nombre = info?.nombre || i.id;
      if (i.expira) {
        const resta = i.expira - ahora;
        const h = Math.floor(resta / 3600000);
        const m = Math.floor((resta % 3600000) / 60000);
        return `• ${nombre} — expira en *${h}h ${m}m*`;
      }
      if (i.usos !== undefined) {
        return `• ${nombre} — *${i.usos} usos* restantes`;
      }
      return `• ${nombre}`;
    }).join("\n");

    await sock.sendMessage(chatId, {
      text: [
        `╔══════════════════════════╗`,
        `   🎒 TU INVENTARIO`,
        `╚══════════════════════════╝`,
        ``,
        lista,
      ].join("\n"),
    }, { quoted: msg });
  },
};