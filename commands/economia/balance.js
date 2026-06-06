import { loadDB, getUser, fmt, numId } from "./db.js";

const EMOJI_MASCOTA = {
  perro: "🐕", gato: "🐈", zorro: "🦊",
  dragon: "🐉", unicornio: "🦄", fenix: "🔥"
};

const EMOJI_NEGOCIO = {
  puesto: "🥤", tienda: "🏪", empresa: "🏢",
  fabrica: "🏭", casino: "🎰", banco_neg: "🏦"
};

export default {
  name: "balance",
  aliases: ["bal", "saldo", "perfil"],
  description: "Ver tu perfil económico",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db = loadDB();

    const mentioned =
      msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let id, nombre;
    if (mentioned) {
      id     = numId(mentioned);
      nombre = `@${id}`;
    } else {
      id     = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);
      nombre = msg?.pushName || `+${id}`;
    }
    id = numId(sender || msg?.key?.participant || msg?.key?.remoteJid);

    const user = getUser(db, id);
    const total = user.saldo + user.banco;

    // ── Rango ──────────────────────────────────────────────────
    let rango = "👶 Novato";
    if (total >= 100000)    rango = "🥉 Rico";
    if (total >= 1000000)   rango = "🥈 Millonario";
    if (total >= 10000000)  rango = "🥇 Magnate";
    if (total >= 100000000) rango = "👑 Multimillonario";

    // ── Items activos ──────────────────────────────────────────
    const tieneEscudo = user.inventario?.some(i => i.id === "escudo" && i.expira > Date.now());
    const tieneVip    = user.inventario?.some(i => i.id === "vip"    && i.expira > Date.now());

    // ── Mascotas con cantidad ──────────────────────────────────
    const mascotas = user.mascotas || [];
    const totalMascotas = mascotas.reduce((s, m) => s + (m.cantidad ?? 1), 0);
    let listaMascotas = "";
    if (mascotas.length > 0) {
      listaMascotas = mascotas
        .map(m => `${EMOJI_MASCOTA[m.tipo] ?? "🐾"} x${m.cantidad ?? 1}`)
        .join("  ");
    }

    // ── Negocios con cantidad ──────────────────────────────────
    const negocios = user.negocios || [];
    const totalNegocios = negocios.reduce((s, n) => s + (n.cantidad ?? 1), 0);
    let listaNegocios = "";
    if (negocios.length > 0) {
      listaNegocios = negocios
        .map(n => `${EMOJI_NEGOCIO[n.tipo] ?? "🏢"} x${n.cantidad ?? 1}`)
        .join("  ");
    }

    // ── Ganancia por hora estimada ─────────────────────────────
    const GANANCIA_MASCOTA = { perro: 5000, gato: 10000, zorro: 25000, dragon: 100000, unicornio: 200000, fenix: 500000 };
    const GANANCIA_NEGOCIO = { puesto: 10000, tienda: 50000, empresa: 250000, fabrica: 600000, casino: 1500000, banco_neg: 3000000 };

    const gananciaMascotaHr = mascotas.reduce((s, m) => s + (GANANCIA_MASCOTA[m.tipo] ?? 0) * (m.cantidad ?? 1), 0);
    const gananciaNegocioHr = negocios.reduce((s, n) => s + (GANANCIA_NEGOCIO[n.tipo] ?? 0) * (n.cantidad ?? 1), 0);
    const totalHr           = gananciaMascotaHr + gananciaNegocioHr;

    // ── Stats ──────────────────────────────────────────────────
    const trabajos = user.estadisticas?.trabajos || 0;
    const robos    = user.estadisticas?.robos    || 0;
    const pesca    = user.estadisticas?.pesca    || 0;
    const mineria  = user.estadisticas?.mineria  || 0;
    const inventario = user.inventario?.length   || 0;

    // ── Texto ──────────────────────────────────────────────────
    const lineas = [
      `╭━━━━━━━━━━━━━━━━━━━━━━╮`,
      `┃  🌸 *PERFIL ECONÓMICO* 🌸  ┃`,
      `╰━━━━━━━━━━━━━━━━━━━━━━╯`,
      ``,
      `🌸 *${nombre}*`,
      `🏅 *Rango:* ${rango}`,
      ``,
      `╭─ 💸 *DINERO*`,
      `│ 💰 Billetera: *${fmt(user.saldo)}*`,
      `│ 🏦 Banco: *${fmt(user.banco)}*`,
      `│ 💎 Patrimonio: *${fmt(total)}*`,
      `╰──────────────────────`,
      ``,
      `╭─ 📈 *INGRESOS PASIVOS*`,
      `│ 🐾 Mascotas/hr: *${fmt(gananciaMascotaHr)}*`,
      `│ 🏢 Negocios/hr: *${fmt(gananciaNegocioHr)}*`,
      `│ ✨ Total/hr: *${fmt(totalHr)}*`,
      `╰──────────────────────`,
      ``,
    ];

    if (totalMascotas > 0) {
      lineas.push(`╭─ 🐾 *MASCOTAS* (${totalMascotas})`);
      lineas.push(`│ ${listaMascotas}`);
      lineas.push(`╰──────────────────────`);
      lineas.push(``);
    }

    if (totalNegocios > 0) {
      lineas.push(`╭─ 🏢 *NEGOCIOS* (${totalNegocios})`);
      lineas.push(`│ ${listaNegocios}`);
      lineas.push(`╰──────────────────────`);
      lineas.push(``);
    }

    lineas.push(`╭─ 📊 *ESTADÍSTICAS*`);
    lineas.push(`│ 🔨 Trabajos: *${trabajos}*`);
    lineas.push(`│ 🦹 Robos: *${robos}*`);
    lineas.push(`│ 🎣 Pesca: *${pesca}*`);
    lineas.push(`│ ⛏️ Minería: *${mineria}*`);
    lineas.push(`│ 🎒 Inventario: *${inventario} items*`);
    lineas.push(`╰──────────────────────`);

    if (tieneEscudo || tieneVip) {
      lineas.push(``);
      lineas.push(`╭─ ✨ *ACTIVO*`);
      if (tieneEscudo) lineas.push(`│ 🛡️ Escudo Anti-Robo activo`);
      if (tieneVip)    lineas.push(`│ ⭐ Membresía VIP activa`);
      lineas.push(`╰──────────────────────`);
    }

    lineas.push(``);
    lineas.push(`> 🌸 _Sigue creciendo, ${nombre.split(" ")[0]}_ 💕`);

    await sock.sendMessage(chatId, {
      text: lineas.filter(l => l !== null).join("\n")
    }, { quoted: msg });
  },
};