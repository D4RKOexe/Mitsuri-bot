import axios from "axios";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/ttdlmp4`;
const APIKEY = process.env.DV_API_KEY;

function extractTikTokUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0].trim() : null;
}

export default {
  name: "tt",
  aliases: ["tiktok", "ttsearch"],
  run: async (sock, msg, args, jid) => {
    if (!args || args.length === 0) {
      return reply(sock, jid,
        "❌ Envía un link o búsqueda de TikTok.\n" +
        "📌 Ej link: `.tt https://vt.tiktok.com/abc`\n" +
        "📌 Ej búsqueda: `.tt edits anime`",
        msg
      );
    }

    const text = args.join(" ").trim();
    const tiktokUrl = extractTikTokUrl(text);

    try { await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }); } catch {}

    // ── MODO 1: LINK DIRECTO ──────────────────────────────
    if (tiktokUrl) {
      await reply(sock, jid, "⬇️ *Descargando TikTok...*", msg);

      try {
        // 1. Consultar nuestra API para obtener el link del video
        const { data } = await axios.get(APIURL, {
          params: { mode: "link", url: tiktokUrl, quality: "best", lang: "es", apikey: APIKEY },
          timeout: 20000,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        });

        if (!data?.ok) throw new Error(data?.detail || "La API no devolvió resultado.");

        const videoUrl = data.download_url_full || data.stream_url_full || data.download_url;
        if (!videoUrl) throw new Error("No se encontró link de descarga.");

        const title = data.title || "TikTok Video";

        // 2. Pasar la URL directo a WhatsApp — sin bajar nada al disco
        await sock.sendMessage(jid, {
          video: { url: videoUrl },
          caption: `🎵 *${title}*\n✅ *TikTok listo!*`,
          mimetype: "video/mp4",
          ptv: false,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      } catch (e) {
        try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}

        let mensajeError = "❌ Error al procesar.";
        if (e.response?.status === 401)     mensajeError = "❌ API Key inválida o vencida.";
        else if (e.code === "ECONNABORTED") mensajeError = "⏳ Tiempo agotado. Intenta de nuevo.";
        else if (e.response?.data?.detail) mensajeError = `❌ ${e.response.data.detail}`;
        else if (e.message)                mensajeError = `❌ ${e.message}`;

        await reply(sock, jid, mensajeError, msg);
      }

    // ── MODO 2: BÚSQUEDA ─────────────────────────────────
    } else {
      try {
        const { data } = await axios.get(
          `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(text)}`
        );

        if (!data?.data?.videos?.length) {
          try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
          return reply(sock, jid, `❌ No encontré videos para: *${text}*`, msg);
        }

        const videos = data.data.videos.slice(0, 4);

        await reply(sock, jid,
          `🔍 *Resultados para:* ${text}\n` +
          `🎵 Enviando ${videos.length} videos...`,
          msg
        );

        for (const v of videos) {
          const titulo = v.title || "TikTok Video";
          const autor  = v.author?.nickname || "Anónimo";
          const likes  = v.digg_count || 0;

          try {
            // Igual — URL directo, sin disco
            await sock.sendMessage(jid, {
              video: { url: v.play },
              caption:
                `🎵 *${titulo}*\n` +
                `👤 *Autor:* ${autor}\n` +
                `❤️ *Likes:* ${likes}`,
              mimetype: "video/mp4",
              ptv: false,
            }, { quoted: msg });
          } catch (e) {
            console.error("[TT VIDEO ERROR]", e.message);
          }
        }

        try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      } catch (e) {
        console.error("[TT SEARCH ERROR]", e.message);
        try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
        await reply(sock, jid, `❌ Error en la búsqueda: ${e.message}`, msg);
      }
    }
  },
};