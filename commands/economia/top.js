import { loadDB, numId, fmt } from "./db.js";

export default {
  name: "top",
  aliases: ["ricos", "ranking", "leaderboard"],
  description: "Top 10 usuarios más ricos",

  async run(sock, msg, args, chatId) {
    const db = loadDB();

    const usuarios = Object.entries(db.usuarios)
      .map(([id, data]) => ({
        id,
        nombre: data.nombre || null,
        total: (data.saldo || 0) + (data.banco || 0),
      }))
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (usuarios.length === 0) {
      return sock.sendMessage(chatId, {
        text: "📊 Nadie tiene dinero todavía. ¡Usa `.daily` para empezar!",
      }, { quoted: msg });
    }

    const medallas = ["🥇", "🥈", "🥉"];

    const lista = usuarios.map((u, i) => {
      const medal = medallas[i] || `${i + 1}.`;
      // Mostrar nombre si existe, si no mostrar número recortado
      const display = u.nombre || `+${u.id}`;
      return `${medal} ${display} — *${fmt(u.total)}*`;
    }).join("\n");

    await sock.sendMessage(chatId, {
      text: [
        `╔══════════════════════════╗`,
        `   🏆 TOP RICOS DEL SERVER`,
        `╚══════════════════════════╝`,
        ``,
        lista,
        ``,
        `💡 Total = billetera + banco`,
      ].join("\n"),
    }, { quoted: msg });
  },
};