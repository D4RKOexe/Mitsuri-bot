import { loadDB, saveDB, getUser, fmt, numId, resolverId } from "./db.js";

const COOLDOWN = 10 * 60 * 1000;
const PROB_EXITO = 0.45;
const MULTA      = 0.20;

export default {
  name: "robar",
  aliases: ["robo", "steal"],
  description: "Intenta robarle dinero a alguien (puede salir mal)",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const send = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    const mentionedJid = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) return send("❌ Menciona a quien quieres robar.\n\nEjemplo: `.robar @usuario`");

    const db     = loadDB();
    const fromId = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
    const toId   = await resolverId(mentionedJid, sock, chatId);

    if (fromId === toId) return send("❌ No puedes robarte a ti mismo.");

    const ladrón  = getUser(db, fromId);
    const víctima = getUser(db, toId);

    const ahora = Date.now();
    const diff  = ahora - (ladrón.lastRobo || 0);
    if (diff < COOLDOWN) {
      const h = Math.floor((COOLDOWN - diff) / 3600000);
      const m = Math.floor(((COOLDOWN - diff) % 3600000) / 60000);
      return send(`⏳ Todavía eres sospechoso.\n\nEspera *${h}h ${m}m* antes de robar de nuevo.`);
    }

    if (víctima.saldo < 10)
      return send(`😂 +${toId} no tiene nada que robar.\n\n👛 Su saldo: *${fmt(víctima.saldo)}*`);

    const tieneEscudo = víctima.inventario?.some(i => i.id === "escudo" && i.expira > ahora);
    if (tieneEscudo) {
      ladrón.lastRobo = ahora;
      saveDB(db);
      return send(`🛡️ +${toId} tiene un *Escudo Anti-Robo* activo.\n\n¡Tu intento de robo falló!`);
    }

    ladrón.lastRobo = ahora;

    let prob = PROB_EXITO;
    const dadosIdx = ladrón.inventario?.findIndex(i => i.id === "dados" && i.usos > 0);
    if (dadosIdx !== undefined && dadosIdx >= 0) {
      prob += 0.20;
      ladrón.inventario[dadosIdx].usos--;
      if (ladrón.inventario[dadosIdx].usos <= 0) ladrón.inventario.splice(dadosIdx, 1);
    }

    if (Math.random() < prob) {
      const robado  = Math.max(1, Math.floor(víctima.saldo * (0.10 + Math.random() * 0.20)));
      víctima.saldo -= robado;
      ladrón.saldo  += robado;
      saveDB(db);
      await send([
        `🦹 *¡Robo exitoso!*`,
        ``,
        `💰 Le robaste *${fmt(robado)}* a +${toId}`,
        `👛 Tu saldo: *${fmt(ladrón.saldo)}*`,
      ].join("\n"));
    } else {
      const multa  = Math.max(1, Math.floor(ladrón.saldo * MULTA));
      ladrón.saldo = Math.max(0, ladrón.saldo - multa);
      saveDB(db);
      await send([
        `👮 *¡Te atraparon robando!*`,
        ``,
        `😬 Intentaste robarle a +${toId} y fallaste.`,
        `💸 Pagaste una multa de *${fmt(multa)}*`,
        `👛 Tu saldo: *${fmt(ladrón.saldo)}*`,
      ].join("\n"));
    }
  },
};