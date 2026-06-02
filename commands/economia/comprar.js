import { loadDB, saveDB, getUser, fmt, numId, TIENDA } from "./db.js";

export default {
  name: "comprar",
  aliases: ["buy", "compra"],
  description: "Comprar un item de la tienda",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    if (!args[0]) {
      return send(
        "❌ Indica qué quieres comprar.\n\nEjemplo: `.comprar escudo`\nVer tienda: `.tienda`"
      );
    }

    const busqueda = args.join(" ").toLowerCase();

    const item = TIENDA.find(
      (i) =>
        i.id === busqueda ||
        i.nombre.toLowerCase().includes(busqueda)
    );

    if (!item) {
      return send(
        "❌ Item no encontrado.\n\nUsa *.tienda* para ver los disponibles."
      );
    }

    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    if (user.saldo < item.precio) {
      return send(
        `❌ No tienes suficiente dinero.\n\n💵 Precio: *${fmt(
          item.precio
        )}*\n👛 Tu saldo: *${fmt(user.saldo)}*`
      );
    }

    user.saldo -= item.precio;

    const ahora = Date.now();

    // Escudo
    if (item.id === "escudo") {
      user.inventario = user.inventario.filter(
        (i) => i.id !== "escudo"
      );

      user.inventario.push({
        id: "escudo",
        expira: ahora + 24 * 60 * 60 * 1000,
      });
    }

    // VIP
    else if (item.id === "vip") {
      user.inventario = user.inventario.filter(
        (i) => i.id !== "vip"
      );

      user.inventario.push({
        id: "vip",
        expira: ahora + 7 * 24 * 60 * 60 * 1000,
      });
    }

    // Pico
    else if (item.id === "pico") {
      const existe = user.inventario.find(
        (i) => i.id === "pico"
      );

      if (existe) {
        existe.usos = (existe.usos || 0) + 3;
      } else {
        user.inventario.push({
          id: "pico",
          usos: 3,
        });
      }
    }

    // Dados
    else if (item.id === "dados") {
      const existe = user.inventario.find(
        (i) => i.id === "dados"
      );

      if (existe) {
        existe.usos = (existe.usos || 0) + 5;
      } else {
        user.inventario.push({
          id: "dados",
          usos: 5,
        });
      }
    }

    // Mascotas
    else if (item.id === "perro") {
      user.mascota = { tipo: "perro" };
    }

    else if (item.id === "gato") {
      user.mascota = { tipo: "gato" };
    }

    else if (item.id === "zorro") {
      user.mascota = { tipo: "zorro" };
    }

    else if (item.id === "dragon") {
      user.mascota = { tipo: "dragon" };
    }

    // Negocios
    else if (item.id === "puesto") {
      user.negocio = { tipo: "puesto" };
    }

    else if (item.id === "tienda") {
      user.negocio = { tipo: "tienda" };
    }

    else if (item.id === "empresa") {
      user.negocio = { tipo: "empresa" };
    }

    // Cajas
    else if (
      item.id === "cajacomun" ||
      item.id === "cajarara" ||
      item.id === "cajalegendaria"
    ) {
      user.inventario.push({
        id: item.id,
      });
    }

    saveDB(db);

    await send(
      [
        `✅ *Compra exitosa*`,
        ``,
        `🛒 Compraste: *${item.nombre}*`,
        `💸 Pagaste: *${fmt(item.precio)}*`,
        `👛 Saldo restante: *${fmt(user.saldo)}*`,
        ``,
        `📝 ${item.desc}`,
      ].join("\n")
    );
  },
};