import axios from "axios";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/spotifysearch`;
const APIKEY = process.env.DV_API_KEY;

export default {
  name: "sps",
  aliases: ["spotifysearch", "buscasp", "spbuscar"],

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const query = args.join(" ").trim();
    if (!query) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe algo para buscar.\nEj: `.sps bad bunny`", msg);
    }

    await react("⏳");

    try {
      const { data } = await axios.get(APIURL, {
        params: { q: query, apikey: APIKEY },
        timeout: 20000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      console.log("[SPS] Respuesta:", JSON.stringify(data).slice(0, 200));

      if (!data?.ok) throw new Error(data?.detail || "Sin resultados.");

      const results = data.results || data.tracks || data.items || [];
      if (!results.length) throw new Error("No encontré resultados.");

      let texto = `🎵 *Spotify Search:* ${query}\n`;
      texto += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      results.slice(0, 5).forEach((t, i) => {
        texto += `*${i + 1}.* ${t.title || t.name || "Sin título"}\n`;
        texto += `   👤 ${t.artist || t.artists || "?"} | ⏱️ ${t.duration || "?"}\n`;
        texto += `   🔗 ${t.url || t.link || ""}\n\n`;
      });

      await react("✅");
      return reply(sock, jid, texto.trim(), msg);

    } catch (e) {
      console.error("[SPS ERROR]", e.response?.data || e.message);
      await react("❌");
      return reply(sock, jid, `❌ ${e.response?.data?.detail || e.message}`, msg);
    }
  },
};