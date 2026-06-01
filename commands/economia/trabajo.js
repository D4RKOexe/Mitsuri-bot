import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const COOLDOWN = 10 * 60 * 1000;

const TRABAJOS = [
  { nombre: "programador", ganancia: [80, 180] },
  { nombre: "repartidor",  ganancia: [50, 120] },
  { nombre: "chef",        ganancia: [60, 150] },
  { nombre: "streamer",    ganancia: [40, 200] },
  { nombre: "mecánico",    ganancia: [70, 160] },
  { nombre: "diseñador",   ganancia: [90, 170] },
  { nombre: "DJ",          ganancia: [100, 250] },
  { nombre: "influencer",  ganancia: [30, 300] },
];

const FRASES = [
  "Trabajaste duro como {trabajo} y ganaste",
  "Pasaste el día de {trabajo} y te pagaron",
  "Terminaste tu turno de {trabajo} y recibiste",
  "Tu jefe como {trabajo} te depositó",
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  name: "trabajo",
  aliases: ["trabajar", "job"],
  description: "Trabaja para ganar dinero cada 2 horas",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    const ahora = Date.now();
    const diff = ahora - (user.lastTrabajo || 0);

    if (diff < COOLDOWN) {
      const restante = COOLDOWN - diff;
      const h = Math.floor(restante / 3600000);
      const m = Math.floor((restante % 3600000) / 60000);
      return sock.sendMessage(chatId, {
        text: `😴 Ya trabajaste hace poco.\n\n⏱️ Descansa y vuelve en *${h}h ${m}m*`,
      }, { quoted: msg });
    }

    const trabajo = TRABAJOS[rand(0, TRABAJOS.length - 1)];
    let [min, max] = trabajo.ganancia;

    // Pico de trabajo → duplica
    const picoIdx = user.inventario?.findIndex(i => i.id === "pico" && i.usos > 0);
    if (picoIdx !== undefined && picoIdx >= 0) {
      min *= 2; max *= 2;
      user.inventario[picoIdx].usos--;
      if (user.inventario[picoIdx].usos <= 0) {
        user.inventario.splice(picoIdx, 1);
      }
    }

    const ganancia = rand(min, max);
    user.saldo += ganancia;
    user.lastTrabajo = ahora;
    saveDB(db);

    const frase = FRASES[rand(0, FRASES.length - 1)].replace("{trabajo}", trabajo.nombre);

    await sock.sendMessage(chatId, {
      text: [
        `💼 *${frase}*`,
        ``,
        `💵 Ganaste: *${fmt(ganancia)}*`,
        `👛 Saldo: *${fmt(user.saldo)}*`,
        ``,
        `⏰ Puedes trabajar de nuevo en *2 horas*`,
      ].join("\n"),
    }, { quoted: msg });
  },
};