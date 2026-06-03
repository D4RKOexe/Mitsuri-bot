import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const NEGOCIOS = {
  puesto: {
    nombre: "🥤 Puesto de Limonada",
    ganancia: 10000
  },

  tienda: {
    nombre: "🏪 Tienda",
    ganancia: 50000
  },

  empresa: {
    nombre: "🏢 Empresa",
    ganancia: 250000
  }
};

const COOLDOWN = 60 * 60 * 1000; // 1 hora

export default {
  name: "negocio",
  aliases: ["business"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {

    const send = (text) =>
      sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();

    const id = numId(
      sender ||
      msg?.key?.participant ||
      msg?.key?.remoteJid
    );

    const user = getUser(db, id);

    // Ver negocio actual
    if (!args[0]) {

      if (!user.negocio) {
        return send(
`❌ No tienes negocio.

Compra uno en la tienda:

🥤 Puesto de Limonada
🏪 Tienda
🏢 Empresa`
        );
      }

      const negocio = NEGOCIOS[user.negocio.tipo];

      if (!negocio) {
        return send("❌ Negocio inválido.");
      }

      const tiempo = Date.now() - (user.lastNegocio || 0);

      const restante = Math.max(
        0,
        COOLDOWN - tiempo
      );

      const minutos = Math.ceil(
        restante / 60000
      );

      return send(
`🏢 TU NEGOCIO

📍 Tipo: ${negocio.nombre}
💰 Producción: ${fmt(negocio.ganancia)} / hora

⏳ Próximo cobro: ${minutos} min

Usa:
.negocio cobrar`
      );
    }

    const accion = args[0].toLowerCase();

    // Cobrar ganancias
    if (accion === "cobrar") {

      if (!user.negocio) {
        return send("❌ No tienes negocio.");
      }

      const negocio = NEGOCIOS[user.negocio.tipo];

      if (!negocio) {
        return send("❌ Negocio inválido.");
      }

      const tiempo = Date.now() - (user.lastNegocio || 0);

      if (tiempo < COOLDOWN) {

        const mins = Math.ceil(
          (COOLDOWN - tiempo) / 60000
        );

        return send(
`⏳ Tu negocio sigue trabajando.

Faltan ${mins} minutos para cobrar.`
        );
      }

      user.saldo += negocio.ganancia;
      user.lastNegocio = Date.now();

      saveDB(db);

      return send(
`🏢 ${negocio.nombre}

💰 Ganaste ${fmt(negocio.ganancia)}

👛 Saldo actual: ${fmt(user.saldo)}`
      );
    }

    return send(
`Uso correcto:

.negocio
.negocio cobrar`
    );
  }
};