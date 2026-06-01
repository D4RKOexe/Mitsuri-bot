import { loadDB, saveDB, getUser, fmt, numId } from "./db.js";

const RESULTADOS = [
  { nombre: "💀 Pierdes todo",  mult: 0,   prob: 0.35 },
  { nombre: "😬 Pierdes mitad", mult: 0.5, prob: 0.20 },
  { nombre: "🔄 Empate",        mult: 1,   prob: 0.15 },
  { nombre: "✨ x1.5",          mult: 1.5, prob: 0.15 },
  { nombre: "🔥 x2",            mult: 2,   prob: 0.10 },
  { nombre: "💎 x3 JACKPOT",    mult: 3,   prob: 0.05 },
];

function girarRuleta(bonusDados = false) {
  let rand = Math.random();
  // Con dados cargados mejora las probabilidades altas
  if (bonusDados) rand = Math.max(rand, Math.random());

  let acum = 0;
  for (const r of RESULTADOS) {
    acum += r.prob;
    if (rand <= acum) return r;
  }
  return RESULTADOS[0];
}

export default {
  name: "ruleta",
  aliases: ["apostar", "bet"],
  description: "Apuesta en la ruleta",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    const db = loadDB();
    const id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const user = getUser(db, id);

    const input = args[0]?.toLowerCase();
    let apuesta;

    if (input === "todo" || input === "all") {
      apuesta = user.saldo;
    } else {
      apuesta = parseFloat(input);
    }

    if (isNaN(apuesta) || apuesta <= 0)
      return send("❌ Indica cuánto apostar.\n\nEjemplo: `.ruleta 200` o `.ruleta todo`");
    if (apuesta < 10)
      return send("❌ La apuesta mínima es *$10.00*");
    if (apuesta > user.saldo)
      return send(`❌ No tienes suficiente.\n\n👛 Saldo: *${fmt(user.saldo)}*`);

    // Dados cargados
    const dadosIdx = user.inventario?.findIndex(i => i.id === "dados" && i.usos > 0);
    const tieneDados = dadosIdx !== undefined && dadosIdx >= 0;
    if (tieneDados) {
      user.inventario[dadosIdx].usos--;
      if (user.inventario[dadosIdx].usos <= 0) user.inventario.splice(dadosIdx, 1);
    }

    const resultado = girarRuleta(tieneDados);
    const ganancia  = Math.floor(apuesta * resultado.mult);
    const diferencia = ganancia - apuesta;

    user.saldo = user.saldo - apuesta + ganancia;
    saveDB(db);

    const linea = diferencia > 0
      ? `💵 Ganaste: *+${fmt(diferencia)}*`
      : diferencia < 0
        ? `💸 Perdiste: *-${fmt(Math.abs(diferencia))}*`
        : `🔄 Recuperaste tu apuesta`;

    await send([
      `🎰 *RULETA*`,
      ``,
      `🎲 Apostaste: *${fmt(apuesta)}*`,
      ``,
      `┌─────────────────────┐`,
      `  ${resultado.nombre}`,
      `└─────────────────────┘`,
      ``,
      linea,
      `👛 Saldo: *${fmt(user.saldo)}*`,
      tieneDados ? `\n🎲 Dados cargados usados (+20% suerte)` : "",
    ].filter(l => l !== "").join("\n"));
  },
};