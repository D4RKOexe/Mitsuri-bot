import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const NEGOCIOS = {
  puesto: {
    nombre: "🥤 Puesto de Limonada",
    precio: 50000,
    ganancia: 2000
  },
  tienda: {
    nombre: "🏪 Tienda",
    precio: 150000,
    ganancia: 8000
  },
  restaurante: {
    nombre: "🍔 Restaurante",
    precio: 500000,
    ganancia: 25000
  },
  fabrica: {
    nombre: "🏭 Fábrica",
    precio: 2000000,
    ganancia: 100000
  }
};

const COOLDOWN = 60 * 60 * 1000;

export default {
  name: "negocio",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const user = getUser(db, numId(sender));

    if (!args[0]) {
      return send(
`🏭 *NEGOCIOS*

🥤 puesto → ${fmt(50000)}
🏪 tienda → ${fmt(150000)}
🍔 restaurante → ${fmt(500000)}
🏭 fabrica → ${fmt(2000000)}

Uso:
.negocio comprar puesto
.negocio cobrar`
      );
    }

    const accion = args[0].toLowerCase();

    if (accion === "comprar") {

      const tipo = args[1]?.toLowerCase();

      if (!NEGOCIOS[tipo]) {
        return send("❌ Negocio no válido.");
      }

      if (user.negocio) {
        return send("❌ Ya tienes un negocio.");
      }

      const negocio = NEGOCIOS[tipo];

      if (user.saldo < negocio.precio) {
        return send(
          `❌ No tienes suficiente dinero.\n\n💰 Necesitas ${fmt(negocio.precio)}`
        );
      }

      user.saldo -= negocio.precio;

      user.negocio = tipo;
      user.lastNegocio = Date.now();

      saveDB(db);

      return send(
        `✅ Compraste ${negocio.nombre}\n\n💸 Pagaste ${fmt(negocio.precio)}`
      );
    }

    if (accion === "cobrar") {

      if (!user.negocio) {
        return send("❌ No tienes negocio.");
      }

      const tiempo = Date.now() - user.lastNegocio;

      if (tiempo < COOLDOWN) {

        const mins = Math.ceil(
          (COOLDOWN - tiempo) / 60000
        );

        return send(
          `⏳ Tu negocio sigue trabajando.\n\nFaltan ${mins} minutos.`
        );
      }

      const negocio = NEGOCIOS[user.negocio];

      user.saldo += negocio.ganancia;
      user.lastNegocio = Date.now();

      saveDB(db);

      return send(
        `🏭 ${negocio.nombre}\n\n💰 Ganaste ${fmt(negocio.ganancia)}`
      );
    }
  }
};