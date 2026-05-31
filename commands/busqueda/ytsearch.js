import axios from "axios";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;
const MAX_RESULTS = 5;

export default {
  name: "ytsearch",
  aliases: ["yts", "ytbuscar", "youtube"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const query = args.join(" ").trim();

    if (!query) {
      return reply(sock, jid,
        "❌ Debes escribir algo para buscar.\n\n📌 Uso: *.ytsearch <nombre>*\n\n💡 Ejemplo: *.ytsearch bad bunny*",
        msg
      );
    }

    await reply(sock, jid, `🔍 *Buscando en YouTube:* _${query}_...`, msg);

    try {
      const res = await axios.get(`${API_BASE}/ytsearch`, {
        params: { q: query, limit: MAX_RESULTS, apikey: APIKEY },
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
          "x-api-key": APIKEY,
        },
      });

      const data = res.data;

      if (!data || data.ok === false || !data.results?.length) {
        return reply(sock, jid, `❌ No se encontraron resultados para: *${query}*`, msg);
      }

      let texto = `📺 *Resultados de YouTube para:* _${query}_\n`;
      texto += `${"─".repeat(30)}\n\n`;

      data.results.forEach((video, i) => {
        const titulo  = video?.title || "Sin título";
        const autor   = video?.channel || "Desconocido";
        const url     = video?.url || "";
        const min     = Math.floor((video.duration_seconds || 0) / 60);
        const seg     = String((video.duration_seconds || 0) % 60).padStart(2, "0");
        const duracion = video.duration_seconds ? `${min}:${seg}` : "?";

        texto += `*${i + 1}.* 🎬 ${titulo}\n`;
        texto += `👤 *Canal:* ${autor}\n`;
        texto += `⏱️ *Duración:* ${duracion}\n`;
        if (url) texto += `🔗 ${url}\n`;
        texto += `\n`;
      });

      texto += `${"─".repeat(30)}\n`;
      texto += `💡 Usa *.ytmp4 <url>* o *.ytmp3 <url>* para descargar.`;

      const firstThumbnail = data.results[0]?.thumbnail;

      if (firstThumbnail) {
        await sock.sendMessage(jid, {
          image: { url: firstThumbnail },
          caption: texto
        }, { quoted: msg });
      } else {
        await reply(sock, jid, texto, msg);
      }

    } catch (e) {
      console.error("[YTSEARCH ERROR]", e.message);
      if (e.response?.data?.detail) {
        console.log("[API DETAIL]:", JSON.stringify(e.response.data.detail, null, 2));
      }
      const errorMsg = e.response?.data?.message || e.message;
      await reply(sock, jid, `❌ Error al buscar en YouTube.\n\n🔎 *Razón:* ${errorMsg}`, msg);
    }
  },
};