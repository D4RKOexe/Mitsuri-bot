import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const CAJAS = {
  cajacomun: {
    nombre: "📦 Caja Común",
    premios: [
      { valor: 5000,   prob: 0.40 },
      { valor: 10000,  prob: 0.30 },
      { valor: 15000,  prob: 0.20 },
      { valor: 25000,  prob: 0.10 },
    ]
  },
  cajarara: {
    nombre: "🎁 Caja Rara",
    premios: [
      { valor: 20000,  prob: 0.40 },
      { valor: 40000,  prob: 0.30 },
      { valor: 75000,  prob: 0.20 },
      { valor: 150000, prob: 0.10 },
    ]
  },
  cajalegendaria: {
    nombre: "💎 Caja Legendaria",
    premios: [
      { valor: 100000,  prob: 0.40 },
      { valor: 150000,  prob: 0.30 },
      { valor: 250000,  prob: 0.15 },
      { valor: 300000,  prob: 0.10 },
      { valor: 500000,  prob: 0.04 },
      { valor: 1000000, prob: 0.01 },
    ]
  },
  cajamistica: {
    nombre: "🌌 Caja Mística",
    premios: [
      { valor: 500000,   prob: 0.35 },
      { valor: 1000000,  prob: 0.25 },
      { valor: 2000000,  prob: 0.20 },
      { valor: 5000000,  prob: 0.10 },
      { valor: 10000000, prob: 0.07 },
      { valor: 25000000, prob: 0.03 },
    ]
  }
};

function rollPremio(premios) {
  const roll = Math.random();
  let acum   = 0;
  for (const p of premios) {
    acum += p.prob;
    if (roll < acum) return p.valor;
  }
  return premios[premios.length - 1].valor;
}

function getRareza(valor, premios) {
  const max = premios[premios.length - 1].valor;
  const pct = valor / max;
  if (pct >= 1.0)   return "💫 *¡JACKPOT LEGENDARIO!*";
  if (pct >= 0.5)   return "🌟 *¡Premio épico!*";
  if (pct >= 0.25)  return "✨ *¡Premio raro!*";
  return "🎉 *Premio obtenido*";
}

export default {
  name: "abrir",
  aliases: ["open", "abrircaja"],
  description: "Abre una caja del inventario",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    if (!args[0]) {
      return send(
        `🌸 *Cajas disponibles*\n\n` +
        `📦 *.abrir cajacomun*\n` +
        `🎁 *.abrir cajarara*\n` +
        `💎 *.abrir cajalegendaria*\n` +
        `🌌 *.abrir cajamistica*\n\n` +
        `> _Compra cajas con *comprar <caja>*_ 🌸`
      );
    }

    const caja = args[0].toLowerCase();

    if (!CAJAS[caja]) {
      return send(
        `❌ Caja *${caja}* no existe.\n\n` +
        `Cajas válidas: cajacomun, cajarara, cajalegendaria, cajamistica`
      );
    }

    const db   = loadDB();
    const id   = numId(sender || msg.key.remoteJid);
    const user = getUser(db, id);

    const index = user.inventario.findIndex(i => i.id === caja);
    if (index === -1) {
      return send(`❌ No tienes *${CAJAS[caja].nombre}* en tu inventario.\nCómprala con *comprar ${caja}*`);
    }

    const { nombre, premios } = CAJAS[caja];
    const premio  = rollPremio(premios);
    const rareza  = getRareza(premio, premios);
    const maxPrem = premios[premios.length - 1].valor;

    user.saldo += premio;
    user.inventario.splice(index, 1);

    const restantes = user.inventario.filter(i => i.id === caja).length;

    saveDB(db);

    await send([
      `${nombre}`,
      ``,
      rareza,
      `💰 *${fmt(premio)}*`,
      ``,
      `💵 Saldo: *${fmt(user.saldo)}*`,
      restantes > 0 ? `📦 Te quedan *${restantes}* cajas de este tipo` : ``,
      ``,
      `> 🌸 _¡Suerte la próxima vez!_ 💕`
    ].filter(l => l !== null && l !== undefined && (l !== "" || false)).join("\n"));
  }
};