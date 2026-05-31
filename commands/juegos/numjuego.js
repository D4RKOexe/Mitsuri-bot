import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE    = path.join(__dirname, "../../data/numeros_game.json");
const RECORDS_FILE = path.join(__dirname, "../../data/numeros_records.json");

// ─── Configuración de dificultades ────────────────────────────────────────────
const DIFICULTADES = {
  facil:   { min: 1, max: 100,     intentos: 10, emoji: "🟢", nombre: "FÁCIL",    color: "verde"  },
  dificil: { min: 1, max: 1000,    intentos: 15, emoji: "🟡", nombre: "DIFÍCIL",  color: "amarillo" },
  extremo: { min: 1, max: 10000,   intentos: 20, emoji: "🔴", nombre: "EXTREMO",  color: "rojo"   },
  leyenda: { min: 1, max: 1000000, intentos: 30, emoji: "💀", nombre: "LEYENDA",  color: "negro"  },
};

// ─── Frases aleatorias de pista ───────────────────────────────────────────────
const FRASES_ALTO = [
  "📈 ¡Más alto! Sigue subiendo...",
  "⬆️ ¡Frío frío! El número es mayor.",
  "🚀 ¡Apunta más arriba!",
  "📈 ¡Vas por debajo! Sube un poco más.",
  "⬆️ ¡El número está más arriba, no te rindas!",
];

const FRASES_BAJO = [
  "📉 ¡Más bajo! Te pasaste.",
  "⬇️ ¡Caliente caliente! Pero te fuiste arriba.",
  "📉 ¡Baja un poco más, casi lo tienes!",
  "⬇️ ¡Demasiado alto! El número está más abajo.",
  "📉 ¡Regresa! El número es menor.",
];

const FRASES_CERCA = [
  "🔥 ¡CALIENTE! Estás muy cerca...",
  "🌡️ ¡Casi casi! ¡No te rajes!",
  "👀 ¡Lo siento cerca! ¡Un poco más!",
];

function frase(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Persistencia sesiones ────────────────────────────────────────────────────
function loadSesiones() {
  try {
    if (fs.existsSync(DATA_FILE)) return fs.readJsonSync(DATA_FILE);
  } catch {}
  return {};
}

function saveSesiones(data) {
  try {
    fs.ensureDirSync(path.dirname(DATA_FILE));
    fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
  } catch (e) {
    console.error("[NUMGAME] Error guardando sesión:", e.message);
  }
}

function getSesion(jid, sender) {
  return loadSesiones()[jid]?.[sender] || null;
}

function setSesion(jid, sender, sesion) {
  const data = loadSesiones();
  if (!data[jid]) data[jid] = {};
  data[jid][sender] = sesion;
  saveSesiones(data);
}

function deleteSesion(jid, sender) {
  const data = loadSesiones();
  if (data[jid]) {
    delete data[jid][sender];
    if (Object.keys(data[jid]).length === 0) delete data[jid];
  }
  saveSesiones(data);
}

// ─── Persistencia records ─────────────────────────────────────────────────────
function loadRecords() {
  try {
    if (fs.existsSync(RECORDS_FILE)) return fs.readJsonSync(RECORDS_FILE);
  } catch {}
  return { global: {}, grupos: {} };
}

function saveRecords(data) {
  try {
    fs.ensureDirSync(path.dirname(RECORDS_FILE));
    fs.writeJsonSync(RECORDS_FILE, data, { spaces: 2 });
  } catch (e) {
    console.error("[NUMGAME] Error guardando records:", e.message);
  }
}

// ✅ CORREGIDO: solo guarda el mejor resultado por jugador
function guardarRecord(jid, sender, dificultad, intentos, tiempoSeg) {
  const data = loadRecords();
  const fecha = new Date().toLocaleDateString("es-CO");

  const entrada = { sender, intentos, tiempo: tiempoSeg, fecha };

  function actualizarLista(lista) {
    const idx = lista.findIndex(r => r.sender === sender);

    if (idx !== -1) {
      const existente = lista[idx];
      const esMejor =
        intentos < existente.intentos ||
        (intentos === existente.intentos && tiempoSeg < existente.tiempo);

      if (!esMejor) return lista; // No era mejor, no cambiar nada
      lista.splice(idx, 1);      // Quitar el record anterior
    }

    lista.push(entrada);
    lista.sort((a, b) =>
      a.intentos !== b.intentos ? a.intentos - b.intentos : a.tiempo - b.tiempo
    );
    return lista.slice(0, 10);
  }

  if (!data.global[dificultad]) data.global[dificultad] = [];
  data.global[dificultad] = actualizarLista(data.global[dificultad]);

  if (!data.grupos[jid]) data.grupos[jid] = {};
  if (!data.grupos[jid][dificultad]) data.grupos[jid][dificultad] = [];
  data.grupos[jid][dificultad] = actualizarLista(data.grupos[jid][dificultad]);

  saveRecords(data);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tiempoTranscurrido(inicio) {
  const seg = Math.floor((Date.now() - new Date(inicio).getTime()) / 1000);
  if (seg < 60) return `${seg} segundos`;
  const min = Math.floor(seg / 60);
  const s   = seg % 60;
  return `${min} min ${s} seg`;
}

function tiempoEnSegundos(inicio) {
  return Math.floor((Date.now() - new Date(inicio).getTime()) / 1000);
}

function barraVida(usados, max) {
  const total  = 10;
  const llenos = Math.round(((max - usados) / max) * total);
  const relleno = llenos > 6 ? "🟩" : llenos > 3 ? "🟨" : "🟥";
  return relleno.repeat(Math.max(0, llenos)) + "⬛".repeat(total - Math.max(0, llenos));
}

function formatSender(sender) {
  return sender.replace("@s.whatsapp.net", "").replace("@lid", "");
}

function formatTiempo(seg) {
  if (seg < 60) return `${seg}s`;
  return `${Math.floor(seg / 60)}m ${seg % 60}s`;
}

// Detecta si el número está "cerca" del objetivo (dentro del 5% del rango)
function estaCerca(numero, objetivo, min, max) {
  const margen = Math.max(5, Math.floor((max - min) * 0.05));
  return Math.abs(numero - objetivo) <= margen;
}

// ─── Mostrar top ──────────────────────────────────────────────────────────────
function mostrarTop(lista, dif) {
  if (!lista || lista.length === 0) {
    return `${dif.emoji} *${dif.nombre}*\n   _Nadie ha jugado aún... ¡sé el primero!_ 👻\n`;
  }

  let texto = `${dif.emoji} *${dif.nombre}* — Top ${lista.length}\n`;
  lista.forEach((r, i) => {
    const medalla =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" :
      `  ${i + 1}.`;
    texto += `${medalla} @${formatSender(r.sender)} › *${r.intentos}* intentos en *${formatTiempo(r.tiempo)}* _(${r.fecha})_\n`;
  });
  return texto;
}

// ─── Comando principal ────────────────────────────────────────────────────────
export default {
  name: "numjuego",
  aliases: ["numerojuego", "numgame", "ng"],

  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const input  = args.join(" ").trim().toLowerCase();
    const sesion = getSesion(jid, sender);

    // ── Si hay sesión activa y escribe algo que no es número ────────────────
    if (sesion && isNaN(input) && input !== "salir") {
      return sock.sendMessage(jid, {
        text:
          `🎮 *¡YA TIENES UNA PARTIDA ACTIVA!*\n` +
          `${"━".repeat(28)}\n\n` +
          `${sesion.dificultad.emoji} Dificultad: *${sesion.dificultad.nombre}*\n` +
          `🎯 Rango: *${sesion.min}* — *${sesion.max.toLocaleString()}*\n` +
          `💭 Intentos: *${sesion.intentosUsados} / ${sesion.dificultad.intentos}*\n\n` +
          `👉 Escribe un *número* para seguir jugando\n` +
          `👉 Escribe *salir* para abandonar la partida`
      }, { quoted: msg });
    }

    // ── Salir del juego ─────────────────────────────────────────────────────
    if (input === "salir" && sesion) {
      deleteSesion(jid, sender);
      return sock.sendMessage(jid, {
        text:
          `🏳️ *PARTIDA ABANDONADA*\n` +
          `${"━".repeat(28)}\n\n` +
          `El número era: *${sesion.numero}* 🔢\n` +
          `Usaste *${sesion.intentosUsados}* de ${sesion.dificultad.intentos} intentos.\n\n` +
          `😔 ¡La próxima vez lo lograrás! Vuelve cuando quieras 💪\n` +
          `▶️ *.ng <dificultad>* para empezar de nuevo`
      }, { quoted: msg });
    }

    // ── Iniciar nueva partida ───────────────────────────────────────────────
    if (!sesion) {
      const dif = DIFICULTADES[input];

      if (!dif) {
        return sock.sendMessage(jid, {
          text:
            `╔══════════════════════════╗\n` +
            `║   🎮  JUEGO DEL NÚMERO   ║\n` +
            `╚══════════════════════════╝\n\n` +
            `Elige tu nivel de dificultad:\n\n` +
            `🟢 *.ng facil*\n` +
            `   Del *1* al *100* · 10 intentos\n\n` +
            `🟡 *.ng dificil*\n` +
            `   Del *1* al *1,000* · 15 intentos\n\n` +
            `🔴 *.ng extremo*\n` +
            `   Del *1* al *10,000* · 20 intentos\n\n` +
            `💀 *.ng leyenda*\n` +
            `   Del *1* al *1,000,000* · 30 intentos\n\n` +
            `${"━".repeat(28)}\n` +
            `🏆 *.ngtop* — Ver el ranking global\n\n` +
            `📌 _Durante el juego escribe un número para adivinar, o *salir* para rendirte._`
        }, { quoted: msg });
      }

      const numero = Math.floor(Math.random() * (dif.max - dif.min + 1)) + dif.min;
      setSesion(jid, sender, {
        numero,
        min: dif.min,
        max: dif.max,
        dificultad: dif,
        intentosUsados: 0,
        inicio: new Date().toISOString(),
      });

      return sock.sendMessage(jid, {
        text:
          `${"🎯".repeat(14)}\n` +
          `🎮 *¡PARTIDA INICIADA!*\n` +
          `${"🎯".repeat(14)}\n\n` +
          `${dif.emoji} Dificultad: *${dif.nombre}*\n` +
          `🔢 Adivina el número del *${dif.min}* al *${dif.max.toLocaleString()}*\n` +
          `💭 Tienes *${dif.intentos}* intentos\n` +
          `⏱️ El tiempo corre desde ahora...\n\n` +
          `🤔 ¡Escribe tu primer número y demuestra lo que sabes!`
      }, { quoted: msg });
    }

    // ── Procesar intento ────────────────────────────────────────────────────
    const numero = parseInt(input);

    if (isNaN(numero)) {
      return sock.sendMessage(jid, {
        text:
          `⚠️ *¡Eso no es un número válido!*\n\n` +
          `Escribe solo dígitos para adivinar.\n` +
          `💭 Intentos restantes: *${sesion.dificultad.intentos - sesion.intentosUsados}*\n` +
          `🎯 Rango: *${sesion.min}* — *${sesion.max.toLocaleString()}*\n\n` +
          `👉 Escribe *salir* para abandonar`
      }, { quoted: msg });
    }

    if (numero < sesion.min || numero > sesion.max) {
      return sock.sendMessage(jid, {
        text:
          `🚫 *¡Número fuera del rango!*\n\n` +
          `Debes escribir un número entre *${sesion.min}* y *${sesion.max.toLocaleString()}*\n` +
          `💭 Intentos restantes: *${sesion.dificultad.intentos - sesion.intentosUsados}*`
      }, { quoted: msg });
    }

    sesion.intentosUsados++;

    // ── GANÓ ────────────────────────────────────────────────────────────────
    if (numero === sesion.numero) {
      const tiempo    = tiempoTranscurrido(sesion.inicio);
      const tiempoSeg = tiempoEnSegundos(sesion.inicio);
      const difKey    = Object.keys(DIFICULTADES).find(k =>
        DIFICULTADES[k].nombre === sesion.dificultad.nombre
      );

      guardarRecord(jid, sender, difKey, sesion.intentosUsados, tiempoSeg);
      deleteSesion(jid, sender);

      const trofeo =
        sesion.intentosUsados === 1
          ? "🏆 *¡LEGENDARIO! ¡PRIMER INTENTO!* 🏆\n_Eso es prácticamente imposible... ¡genio!_"
        : sesion.intentosUsados <= 3
          ? "🥇 *¡INCREÍBLE! ¡Pocos intentos!*\n_Tienes un don para esto, ¡impresionante!_"
        : sesion.intentosUsados <= 7
          ? "🥈 *¡MUY BIEN JUGADO!*\n_Buen razonamiento, ¡sigue así!_"
          : "🥉 *¡LO LOGRASTE!*\n_¡Nunca te rendiste y ganaste!_";

      return sock.sendMessage(jid, {
        text:
          `🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊\n` +
          `  ✅ *¡¡¡CORRECTO!!!* ✅\n` +
          `🎉🎊🎉🎊🎉🎊🎉🎊🎉🎊\n\n` +
          `${trofeo}\n\n` +
          `${"━".repeat(28)}\n` +
          `🔢 El número era: *${sesion.numero}*\n` +
          `💭 Intentos: *${sesion.intentosUsados} / ${sesion.dificultad.intentos}*\n` +
          `⏱️ Tiempo: *${tiempo}*\n` +
          `${sesion.dificultad.emoji} Dificultad: *${sesion.dificultad.nombre}*\n` +
          `${"━".repeat(28)}\n\n` +
          `💾 ¡Tu record fue guardado!\n` +
          `🏆 Usa *.ngtop* para ver el ranking\n` +
          `🎮 ¿Revancha? Usa *.ng* para jugar de nuevo`
      }, { quoted: msg });
    }

    // ── GAME OVER ───────────────────────────────────────────────────────────
    if (sesion.intentosUsados >= sesion.dificultad.intentos) {
      deleteSesion(jid, sender);

      return sock.sendMessage(jid, {
        text:
          `💀💀💀💀💀💀💀💀💀💀\n` +
          `     ❌ *GAME OVER* ❌\n` +
          `💀💀💀💀💀💀💀💀💀💀\n\n` +
          `😵 Se agotaron tus *${sesion.dificultad.intentos}* intentos...\n\n` +
          `${"━".repeat(28)}\n` +
          `🔢 El número era: *${sesion.numero}*\n` +
          `${sesion.dificultad.emoji} Dificultad: *${sesion.dificultad.nombre}*\n` +
          `⏱️ Tiempo jugado: *${tiempoTranscurrido(sesion.inicio)}*\n` +
          `${"━".repeat(28)}\n\n` +
          `💪 ¡No te desanimes! Cada intento te hace mejor.\n` +
          `🎮 ¡Vuelve a intentarlo con *.ng*!`
      }, { quoted: msg });
    }

    // ── Pista ───────────────────────────────────────────────────────────────
    const restantes = sesion.dificultad.intentos - sesion.intentosUsados;
    const barra     = barraVida(sesion.intentosUsados, sesion.dificultad.intentos);
    const cerca     = estaCerca(numero, sesion.numero, sesion.min, sesion.max);

    let pistaMensaje;
    if (cerca) {
      pistaMensaje = frase(FRASES_CERCA) + (numero < sesion.numero ? "\n📈 ¡Pero sigue subiendo!" : "\n📉 ¡Pero baja un poco!");
    } else {
      pistaMensaje = numero < sesion.numero ? frase(FRASES_ALTO) : frase(FRASES_BAJO);
    }

    const urgencia =
      restantes === 1
        ? `\n\n🆘 *¡¡ÚLTIMO INTENTO!! ¡No lo desperdicies!*`
      : restantes <= 3
        ? `\n\n⚠️ *¡Solo ${restantes} intentos restantes! ¡Piensa bien!*`
      : restantes <= 5
        ? `\n\n😬 *¡Cuidado! Quedan ${restantes} intentos...*`
        : "";

    setSesion(jid, sender, sesion);

    return sock.sendMessage(jid, {
      text:
        `${pistaMensaje}\n` +
        `${"━".repeat(28)}\n\n` +
        `🔢 Tu número: *${numero.toLocaleString()}*\n` +
        `💭 Intentos: *${sesion.intentosUsados} / ${sesion.dificultad.intentos}*\n` +
        `${barra}\n\n` +
        `🎯 Busca entre *${sesion.min.toLocaleString()}* y *${sesion.max.toLocaleString()}*` +
        `${urgencia}`
    }, { quoted: msg });
  },
};

// ─── Comando top ──────────────────────────────────────────────────────────────
export const ngtop = {
  name: "ngtop",
  aliases: ["numtop", "gtop", "rankingjuego"],

  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const sub  = (args[0] || "global").toLowerCase();
    const data = loadRecords();

    // ── Top global ────────────────────────────────────────────────────────
    if (sub === "global") {
      const menciones = [];
      let texto =
        `╔══════════════════════════════╗\n` +
        `║  🌍  RANKING GLOBAL  🌍      ║\n` +
        `║    🎮  JUEGO DEL NÚMERO  🎮  ║\n` +
        `╚══════════════════════════════╝\n\n`;

      for (const [key, dif] of Object.entries(DIFICULTADES)) {
        const lista = data.global[key] || [];
        texto += mostrarTop(lista, dif) + "\n";
        lista.forEach(r => { if (!menciones.includes(r.sender)) menciones.push(r.sender); });
      }

      texto +=
        `${"━".repeat(28)}\n` +
        `👥 *.ngtop grupo* — ranking de este grupo\n` +
        `🎯 *.ngtop <dificultad>* — ver una categoría`;

      return sock.sendMessage(jid, { text: texto, mentions: menciones }, { quoted: msg });
    }

    // ── Top por grupo ─────────────────────────────────────────────────────
    if (sub === "grupo" || sub === "local") {
      if (!isGroup) {
        return sock.sendMessage(jid, {
          text: "❌ Este comando solo funciona dentro de un grupo."
        }, { quoted: msg });
      }

      const menciones = [];
      let texto =
        `╔══════════════════════════════╗\n` +
        `║  👥  RANKING DEL GRUPO  👥   ║\n` +
        `║    🎮  JUEGO DEL NÚMERO  🎮  ║\n` +
        `╚══════════════════════════════╝\n\n`;

      for (const [key, dif] of Object.entries(DIFICULTADES)) {
        const lista = data.grupos?.[jid]?.[key] || [];
        texto += mostrarTop(lista, dif) + "\n";
        lista.forEach(r => { if (!menciones.includes(r.sender)) menciones.push(r.sender); });
      }

      texto +=
        `${"━".repeat(28)}\n` +
        `🌍 *.ngtop global* — ver el ranking mundial\n` +
        `🎯 *.ngtop <dificultad>* — ver una categoría`;

      return sock.sendMessage(jid, { text: texto, mentions: menciones }, { quoted: msg });
    }

    // ── Top por dificultad específica ─────────────────────────────────────
    const dif = DIFICULTADES[sub];
    if (dif) {
      const menciones  = [];
      const globalLista = data.global[sub] || [];
      const grupoLista  = data.grupos?.[jid]?.[sub] || [];

      let texto =
        `╔══════════════════════════════╗\n` +
        `║  🏆  RANKING ${dif.nombre.padEnd(15)}║\n` +
        `╚══════════════════════════════╝\n\n` +
        `🌍 *Global:*\n` +
        mostrarTop(globalLista, dif);

      if (isGroup) {
        texto += `\n👥 *Este grupo:*\n` + mostrarTop(grupoLista, dif);
      }

      [...globalLista, ...grupoLista].forEach(r => {
        if (!menciones.includes(r.sender)) menciones.push(r.sender);
      });

      return sock.sendMessage(jid, { text: texto, mentions: menciones }, { quoted: msg });
    }

    // ── Ayuda de ngtop ────────────────────────────────────────────────────
    return sock.sendMessage(jid, {
      text:
        `🏆 *USO DE NGTOP*\n` +
        `${"━".repeat(28)}\n\n` +
        `🌍 *.ngtop global*   — ranking mundial\n` +
        `👥 *.ngtop grupo*    — ranking de este grupo\n` +
        `🟢 *.ngtop facil*    — top dificultad fácil\n` +
        `🟡 *.ngtop dificil*  — top dificultad difícil\n` +
        `🔴 *.ngtop extremo*  — top extremo\n` +
        `💀 *.ngtop leyenda*  — top leyenda`
    }, { quoted: msg });
  },
};

// ─── Exportar para index.js ───────────────────────────────────────────────────
export function getSesionJuego(jid, sender) {
  return getSesion(jid, sender);
}