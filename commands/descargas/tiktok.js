import axios from "axios";
import { reply } from "../../utils.js";

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
        const { data } = await axios.get(
          `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(tiktokUrl)}`
        );

        if (!data?.status || !data?.data?.meta?.media?.[0]?.org) {
          throw new Error("No se pudo obtener el video.");
        }

        const videoUrl = data.data.meta.media[0].org;
        const title    = data.data.title || "TikTok Video";
        const autor    = data.data.author?.nickname || "";
        const duracion = data.data.duration || "";

        await sock.sendMessage(jid, {
          video: { url: videoUrl },
          caption:
            `🎵 *${title}*\n` +
            (autor    ? `👤 *Autor:* ${autor}\n`     : "") +
            (duracion ? `⏱️ *Duración:* ${duracion}s` : "") +
            `\n✅ *TikTok listo!*`,
          mimetype: "video/mp4",
          ptv: false,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      } catch (e) {
        try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}

        let mensajeError = "❌ Error al procesar.";
        if (e.code === "ECONNABORTED") mensajeError = "⏳ Tiempo agotado. Intenta de nuevo.";
        else if (e.message)           mensajeError = `❌ ${e.message}`;

        await reply(sock, jid, mensajeError, msg);
      }

    // ── MODO 2: BÚSQUEDA ─────────────────────────────────
    } else {
      try {
        const { data } = await axios.get(
          `https://api.delirius.store/search/tiktoksearch?query=${encodeURIComponent(text)}`
        );

        if (!data?.status || !data?.meta?.length) {
          try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
          return reply(sock, jid, `❌ No encontré videos para: *${text}*`, msg);
        }

        const videos = data.meta.slice(0, 4);

        await reply(sock, jid,
          `🔍 *Resultados para:* ${text}\n` +
          `🎵 Enviando ${videos.length} videos...`,
          msg
        );

        for (const v of videos) {
          const titulo   = v.title || "TikTok Video";
          const autor    = v.author?.nickname || v.author?.username || "Anónimo";
          const likes    = v.like?.toLocaleString() || "?";
          const duracion = v.duration || "?";

          try {
            await sock.sendMessage(jid, {
              video: { url: v.url },
              caption:
                `🎵 *${titulo}*\n` +
                `👤 *Autor:* ${autor}\n` +
                `❤️ *Likes:* ${likes}\n` +
                `⏱️ *Duración:* ${duracion}s`,
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