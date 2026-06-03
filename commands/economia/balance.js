import { loadDB, getUser, fmt, numId } from "./db.js";

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
      id = numId(mentioned);
      nombre = `@${id}`;
    } else {
      id = numId(
        sender ||
        msg?.key?.participant ||
        msg?.key?.remoteJid
      );

      nombre = msg?.pushName || `+${id}`;
    }

    const user = getUser(db, id);

    const total = user.saldo + user.banco;

    const tieneEscudo = user.inventario?.some(
      i => i.id === "escudo" && i.expira > Date.now()
    );

    const tieneVip = user.inventario?.some(
      i => i.id === "vip" && i.expira > Date.now()
    );

    const mascotas = user.mascotas?.length || 0;
    const negocios = user.negocios?.length || 0;
    const inventario = user.inventario?.length || 0;

    const trabajos = user.estadisticas?.trabajos || 0;
    const robos = user.estadisticas?.robos || 0;
    const pesca = user.estadisticas?.pesca || 0;
    const mineria = user.estadisticas?.mineria || 0;

    let rango = "👶 Novato";

    if (total >= 100000) rango = "🥉 Rico";
    if (total >= 1000000) rango = "🥈 Millonario";
    if (total >= 10000000) rango = "🥇 Magnate";
    if (total >= 100000000) rango = "👑 Multimillonario";

    await sock.sendMessage(chatId, {
      text: [
        `╔══════════════════════════╗`,
        `        👤 PERFIL`,
        `╚══════════════════════════╝`,
        ``,
        `🪪 *Nombre:* ${nombre}`,
        `🏅 *Rango:* ${rango}`,
        ``,
        `💰 *Billetera:* ${fmt(user.saldo)}`,
        `🏦 *Banco:* ${fmt(user.banco)}`,
        `💎 *Patrimonio:* ${fmt(total)}`,
        ``,
        `🐾 *Mascotas:* ${mascotas}`,
        `🏢 *Negocios:* ${negocios}`,
        `🎒 *Inventario:* ${inventario}`,
        ``,
        `📊 *Estadísticas*`,
        `🔨 Trabajos: ${trabajos}`,
        `🦹 Robos: ${robos}`,
        `🎣 Pesca: ${pesca}`,
        `⛏️ Minería: ${mineria}`,
        ``,
        tieneEscudo ? `🛡️ Escudo activo` : "",
        tieneVip ? `⭐ VIP activo` : "",
      ].filter(Boolean).join("\n"),
    }, { quoted: msg });
  },
};