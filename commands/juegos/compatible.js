import { reply } from "../../utils.js";
import { isOwner } from "../admin/utils.js";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("data/parejas.json");

function cargarDatos() {
  try {
    if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
    if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, "{}");
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function guardarDatos(datos) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(datos, null, 2));
  } catch (e) {
    console.error("[COMPATIBLE] Error guardando JSON:", e.message);
  }
}

function hashNombres(a, b) {
  const str = [a, b].sort().join("").toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 100;
  }
  return hash;
}

function getPorcentaje(id1, id2) {
  const base  = hashNombres(id1, id2);
  const extra = (id1.length + id2.length) % 20;
  return Math.min(99, Math.max(1, (base + extra) % 100 + 1));
}

function getNivel(pct) {
  if (pct >= 90) return { nivel: "ALMAS GEMELAS",  emoji: "💞", color: "🔴" };
  if (pct >= 75) return { nivel: "AMOR INTENSO",   emoji: "❤️",  color: "🟠" };
  if (pct >= 60) return { nivel: "BUENA PAREJA",   emoji: "💕", color: "🟡" };
  if (pct >= 45) return { nivel: "HAY QUÍMICA",    emoji: "✨", color: "🟢" };
  if (pct >= 30) return { nivel: "AMISTAD BONITA", emoji: "💛", color: "🔵" };
  if (pct >= 15) return { nivel: "COMPLICADO",     emoji: "😬", color: "🟣" };
  return          { nivel: "INCOMPATIBLES",        emoji: "💔", color: "⚫" };
}

function getBarraPorcentaje(pct) {
  const total  = 10;
  const llenos = Math.round((pct / 100) * total);
  return "█".repeat(llenos) + "░".repeat(total - llenos);
}

function getMensaje(pct) {
  if (pct >= 90) return ["El universo los conspiró para estar juntos. ✨", "Rara combinación perfecta. ¡No la desperdicien! 💫", "Están hechos el uno para el otro. 🌹"];
  if (pct >= 75) return ["Hay una chispa que no se apaga fácil. 🔥", "Tienen todo para que funcione, solo necesitan comunicación. 💬", "La atracción entre ellos es innegable. 😏"];
  if (pct >= 60) return ["Forman una buena dupla si se lo proponen. 💪", "Tienen más cosas en común de lo que creen. 🎯", "Con esfuerzo y cariño esto puede ir muy lejos. 🚀"];
  if (pct >= 45) return ["Hay algo ahí, pero hay que trabajarlo. 🛠️", "No es amor a primera vista, pero el tiempo dirá. ⏳", "La química existe, solo está un poco dormida. 😴"];
  if (pct >= 30) return ["Son mejores amigos que pareja. 🤝", "La amistad los une más que el amor. 😊", "Juntos son geniales, pero en plan amigos. 👫"];
  if (pct >= 15) return ["Necesitarían mucho esfuerzo para que funcione. 😅", "Hay más diferencias que similitudes. 😬", "La compatibilidad no es su punto fuerte, pero nunca se sabe. 🤷"];
  return ["El universo dice que no. Las estrellas también. 🌌", "Incompatibles a niveles cósmicos. Pero el amor es ciego. 😂", "Mejor como desconocidos. 💀"];
}

function getCategorias(pct, seed) {
  const v = (offset) => Math.min(99, Math.max(1, pct + ((seed + offset) % 21) - 10));
  return { amor: v(3), confianza: v(7), pasion: v(13), amistad: v(17) };
}

function formatMention(jid) {
  return "@" + jid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "");
}

function clavePareja(id1, id2) {
  return [id1, id2].sort().join("_");
}

// ─── Mensajes especiales cuando usan el comando con el owner ──────────────────
const MENSAJES_OWNER = [
  "👑 Él está en otro nivel, bb. Ni lo intentes. 😂",
  "💀 El sistema se negó a calcular eso. Demasiada diferencia. 👑",
  "😂 El bot se rió solo al ver esta combinación. 0% y punto.",
  "🚫 Acceso denegado. El owner es incompatible con mortales. 👑",
  "💔 Las estrellas, el universo y hasta el WiFi dicen que no. 😂",
  "👑 Él es demasiado para ti. El bot lo sabe, tú también. 😏",
];

export default {
  name: "compatible",
  aliases: ["amor", "pareja", "ship", "compatibilidad"],
  description: "Calcula compatibilidad entre dos usuarios por @",
  usage: ".compatible @usuario  |  .compatible @usuario1 @usuario2",

  run: async (sock, msg, args, jid) => {
    const mencionados =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    const remitente = msg.key.participant || msg.key.remoteJid;

    let id1, id2;

    if (mencionados.length === 0) {
      return reply(sock, jid,
        `❌ *Uso correcto:*\n\n` +
        `👤 *.compatible @usuario* — Tú vs ese usuario\n` +
        `👥 *.compatible @usuario1 @usuario2* — Entre esos dos\n\n` +
        `📌 Ejemplos:\n` +
        `   *.compatible @57300...*\n` +
        `   *.compatible @57300... @57311...*`,
        msg
      );
    } else if (mencionados.length === 1) {
      id1 = remitente;
      id2 = mencionados[0];
    } else {
      id1 = mencionados[0];
      id2 = mencionados[1];
    }

    if (id1 === id2) {
      return reply(sock, jid, "😂 No puedes ser compatible contigo mismo... o sí? 🤔", msg);
    }

    // ── Modo especial: si alguno es el owner → 0% ─────────────────────────
    const ownerEsId1 = isOwner(id1);
    const ownerEsId2 = isOwner(id2);
    const involucraOwner = ownerEsId1 || ownerEsId2;

    if (involucraOwner) {
      const ownerJid = ownerEsId1 ? id1 : id2;
      const otroJid  = ownerEsId1 ? id2 : id1;
      const mOwner   = formatMention(ownerJid);
      const mOtro    = formatMention(otroJid);
      const mensajeRandom = MENSAJES_OWNER[Math.floor(Math.random() * MENSAJES_OWNER.length)];

      const texto =
        `╭━━━〔 💘 COMPATIBILIDAD 〕━━━⬣\n` +
        `┃\n` +
        `┃ 👑 *${mOwner}*\n` +
        `┃ 💞 con\n` +
        `┃ 👤 *${mOtro}*\n` +
        `┃\n` +
        `┃ ⚫ *0% compatible*\n` +
        `┃ ░░░░░░░░░░\n` +
        `┃\n` +
        `┃ 💔 *Nivel:* IMPOSIBLE\n` +
        `┃\n` +
        `┃ ❤️  *Amor:*      0%\n` +
        `┃ 🤝 *Confianza:* 0%\n` +
        `┃ 🔥 *Pasión:*    0%\n` +
        `┃ 😄 *Amistad:*   0%\n` +
        `┃\n` +
        `┃ 😂 _${mensajeRandom}_\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━⬣`;

      return await sock.sendMessage(jid, {
        text: texto,
        mentions: [ownerJid, otroJid],
      }, { quoted: msg });
    }

    // ── Flujo normal ──────────────────────────────────────────────────────
    const datos = cargarDatos();
    const clave = clavePareja(id1, id2);

    let pct, cats, esNuevo;

    if (datos[clave]) {
      pct     = datos[clave].porcentaje;
      cats    = datos[clave].categorias;
      esNuevo = false;
    } else {
      const seed = id1.length + id2.length;
      pct        = getPorcentaje(id1, id2);
      cats       = getCategorias(pct, seed);
      esNuevo    = true;

      datos[clave] = {
        id1, id2,
        porcentaje: pct,
        categorias: cats,
        fecha: new Date().toISOString(),
      };

      guardarDatos(datos);
    }

    const { nivel, emoji, color } = getNivel(pct);
    const barra   = getBarraPorcentaje(pct);
    const lista   = getMensaje(pct);
    const mensaje = lista[Math.floor(Math.random() * lista.length)];
    const m1 = formatMention(id1);
    const m2 = formatMention(id2);

    const texto =
      `╭━━━〔 💘 COMPATIBILIDAD 〕━━━⬣\n` +
      `┃\n` +
      `┃ 👤 *${m1}*\n` +
      `┃ 💞 con\n` +
      `┃ 👤 *${m2}*\n` +
      `┃\n` +
      `┃ ${color} *${pct}% compatible*\n` +
      `┃ ${barra}\n` +
      `┃\n` +
      `┃ ${emoji} *Nivel:* ${nivel}\n` +
      `┃\n` +
      `┃ ❤️  *Amor:*      ${cats.amor}%\n` +
      `┃ 🤝 *Confianza:* ${cats.confianza}%\n` +
      `┃ 🔥 *Pasión:*    ${cats.pasion}%\n` +
      `┃ 😄 *Amistad:*   ${cats.amistad}%\n` +
      `┃\n` +
      `┃ 💬 _${mensaje}_\n` +
      `┃\n` +
      `┃ ${esNuevo ? "🆕 _Primera vez registrada_ ✅" : "📂 _Resultado guardado_"}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`;

    await sock.sendMessage(jid, {
      text: texto,
      mentions: [id1, id2],
    }, { quoted: msg });
  },
};