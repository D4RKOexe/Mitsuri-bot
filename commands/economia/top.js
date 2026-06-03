import { loadDB, numId, fmt } from "./db.js";

// ══════════════════════════════════════════
//  RANGOS ECONÓMICOS
// ══════════════════════════════════════════
function getRango(total) {
  if (total >= 10_000_000) return { emoji: "👑", nombre: "Multimillonario" };
  if (total >= 1_000_000)  return { emoji: "🥇", nombre: "Magnate"         };
  if (total >= 500_000)    return { emoji: "🥈", nombre: "Millonario"       };
  if (total >= 100_000)    return { emoji: "🥉", nombre: "Rico"             };
  return                          { emoji: "👶", nombre: "Novato"           };
}

// ══════════════════════════════════════════
//  MEDALLAS
// ══════════════════════════════════════════
const MEDALLAS = ["🥇", "🥈", "🥉"];
function getMedalla(i) {
  return MEDALLAS[i] ?? "🏅";
}

// ══════════════════════════════════════════
//  BARRA DE RIQUEZA (visual relativo al #1)
// ══════════════════════════════════════════
function getBarra(total, max, largo = 8) {
  const bloques  = ["░", "▒", "▓", "█"];
  const relleno  = Math.round((total / max) * largo);
  const vacio    = largo - relleno;
  return "█".repeat(relleno) + "░".repeat(vacio);
}

// ══════════════════════════════════════════
//  MENSAJE DINÁMICO SEGÚN POSICIÓN
// ══════════════════════════════════════════
function getMensajePosicion(pos) {
  if (pos === 1)  return "👑 ¡Eres el más rico del servidor! ¡Nadie te alcanza!";
  if (pos === 2)  return "🥈 Estás muy cerca del trono... ¡sigue empujando!";
  if (pos === 3)  return "🥉 Top 3 — ¡Estás entre la élite económica!";
  if (pos <= 10)  return `🏅 Estás en el puesto #${pos} — ¡dentro del Top 10!`;
  if (pos <= 25)  return `📈 Posición #${pos} — ¡Sigue acumulando riqueza!`;
  return                 `💪 Posición #${pos} — ¡Aún hay mucho por conquistar!`;
}

export default {
  name: "top",
  aliases: ["ricos", "ranking", "leaderboard"],
  description: "Top 10 usuarios más ricos",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();

    // ── Construir lista completa ordenada ──────────────────────────
    const todos = Object.entries(db.usuarios)
      .map(([id, data]) => ({
        id,
        nombre:   data.nombre || `+${id.slice(0, 8)}`,
        total:    (data.saldo || 0) + (data.banco || 0),
        mascotas: Array.isArray(data.mascotas) ? data.mascotas.length : 0,
        negocios: Array.isArray(data.negocios) ? data.negocios.length : 0,
      }))
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total);

    if (todos.length === 0) {
      return sock.sendMessage(chatId, {
        text: "📊 Nadie tiene dinero todavía. ¡Usa *.daily* para empezar!",
      }, { quoted: msg });
    }

    const top10  = todos.slice(0, 10);
    const maxVal = top10[0].total;

    // ── Posición del usuario que ejecuta ──────────────────────────
    const myId  = numId(sender);
    const myPos = todos.findIndex(u => u.id === myId) + 1; // 0 si no está
    const myData = myPos > 0 ? todos[myPos - 1] : null;

    // ══════════════════════════════════════════
    //  CONSTRUIR TEXTO
    // ══════════════════════════════════════════
    const lineas = [];

    lineas.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
    lineas.push(`┃  🏆  *TABLA DE RICOS*  🏆   ┃`);
    lineas.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
    lineas.push(``);

    top10.forEach((u, i) => {
      const medalla = getMedalla(i);
      const rango   = getRango(u.total);
      const barra   = getBarra(u.total, maxVal);
      const nombre  = u.nombre.length > 14
        ? u.nombre.slice(0, 13) + "…"
        : u.nombre;

      // Línea principal
      lineas.push(`${medalla} *#${i + 1}* ${nombre}`);
      // Rango + patrimonio
      lineas.push(`     ${rango.emoji} ${rango.nombre}  •  💰 ${fmt(u.total)}`);
      // Barra visual
      lineas.push(`     [${barra}]`);
      // Mascotas y negocios
      lineas.push(`     🐾 ×${u.mascotas}  🏢 ×${u.negocios}`);

      // Separador entre entradas (no en la última)
      if (i < top10.length - 1) {
        lineas.push(`     ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
      }
    });

    lineas.push(``);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lineas.push(`💡 *Patrimonio* = billetera + banco`);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ── Sección del usuario ejecutor ──────────────────────────────
    if (myData) {
      const enTop = myPos <= 10;
      lineas.push(``);
      lineas.push(`╔══════════════════════════╗`);
      lineas.push(`║   📌  *TU POSICIÓN*       ║`);
      lineas.push(`╚══════════════════════════╝`);
      lineas.push(``);

      if (!enTop) {
        // Usuario fuera del top 10 — mostrar igual con su info
        const rango  = getRango(myData.total);
        const barra  = getBarra(myData.total, maxVal);
        const nombre = myData.nombre.length > 14
          ? myData.nombre.slice(0, 13) + "…"
          : myData.nombre;

        lineas.push(`🏅 *#${myPos}* ${nombre}`);
        lineas.push(`     ${rango.emoji} ${rango.nombre}  •  💰 ${fmt(myData.total)}`);
        lineas.push(`     [${barra}]`);
        lineas.push(`     🐾 ×${myData.mascotas}  🏢 ×${myData.negocios}`);
        lineas.push(``);
      }

      lineas.push(getMensajePosicion(myPos));
    }

    await sock.sendMessage(chatId, {
      text: lineas.join("\n"),
    }, { quoted: msg });
  },
};