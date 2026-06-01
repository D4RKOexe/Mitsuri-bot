import { TIENDA, fmt } from "./db.js";

export default {
  name: "tienda",
  aliases: ["shop", "store"],
  description: "Ver los items disponibles en la tienda",

  async run(sock, msg, args, chatId) {
    const items = TIENDA.map((item, i) =>
      [
        `${i + 1}. ${item.nombre}`,
        `   💵 Precio: *${fmt(item.precio)}*`,
        `   📝 ${item.desc}`,
      ].join("\n")
    ).join("\n\n");

    await sock.sendMessage(chatId, {
      text: [
        `╔══════════════════════════╗`,
        `   🛒 TIENDA`,
        `╚══════════════════════════╝`,
        ``,
        items,
        ``,
        `Compra con: *.comprar <nombre del item>*`,
        `Ej: *.comprar escudo*`,
      ].join("\n"),
    }, { quoted: msg });
  },
};