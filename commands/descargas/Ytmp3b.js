import axios from "axios";
import yts from "yt-search";
import { reply } from "../../utils.js";

const RYZE_API      = "https://ryzecodes.xyz/api/scrapers/36/run";
const RYZE_KEY      = "ryzk0cdn";
const RYZE_FORMAT   = "mp3";
const RYZE_ATTEMPTS = 6;
const RYZE_INTERVAL = 1100;

function getVideoId(text) {
  const m = String(text || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/);
  return m?.[1] || null;
}

async function getVideoInfo(query, videoId) {
  if (videoId) {
    try {
      const info = await yts({ videoId });
      if (info?.videoId) return { ...info, url: `https://youtu.be/${info.videoId}`, image: info.thumbnail || info.image };
    } catch {}
  }
  const search = await yts(query);
  return search.videos?.[0] || null;
}

async function getAudioFromRyze(url) {
  const res = await axios.post(RYZE_API, {
    input: { url, format: RYZE_FORMAT, attempts: RYZE_ATTEMPTS, interval_ms: RYZE_INTERVAL }
  }, {
    headers: { "Content-Type": "application/json", "X-API-Key": RYZE_KEY },
    timeout: 120000,
  });

  const result = res.data?.result;
  if (!res.data?.success || !result?.success) throw new Error(res.data?.error || result?.error || "API sin resultado.");

  const audioUrl = result.file_url || result.download_urls?.[0] || null;
  if (!audioUrl) throw new Error("No se encontró link de descarga.");

  return {
    url:   audioUrl,
    title: result.title || null,
    size:  result.selected_media?.size || null,
  };
}

export default {
  name: "ytmp3b",
  aliases: ["playb", "mp3b", "songb"],
  run: async (sock, msg, args, jid) => {
    const input = args.join(" ").trim();

    if (!input) return reply(sock, jid, "❌ *Uso:* .ytmp3b <link o nombre de canción>", msg);

    try { await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }); } catch {}

    try {
      const videoId = getVideoId(input);
      const query   = videoId ? `https://youtu.be/${videoId}` : input;

      let url       = query;
      let title     = "audio";
      let thumbnail = null;

      const info = await getVideoInfo(query, videoId);
      if (info) {
        url       = info.url || `https://youtu.be/${info.videoId}`;
        title     = info.title || title;
        thumbnail = info.image || info.thumbnail || null;

        const caption =
          `🎵 *${title}*\n` +
          `👤 Canal: *${info.author?.name || "Desconocido"}*\n` +
          `⏱️ Duración: *${info.timestamp || "?"}*\n\n⏳ Descargando audio...`;

        if (thumbnail) {
          await sock.sendMessage(jid, { image: { url: thumbnail }, caption }, { quoted: msg });
        } else {
          await reply(sock, jid, caption, msg);
        }
      }

      const audio = await getAudioFromRyze(url);

      await sock.sendMessage(jid, {
        audio:    { url: audio.url },
        mimetype: "audio/mpeg",
        ptt:      false,
      }, { quoted: msg });

      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (e) {
      console.error("[YTMP3B ERROR]", e.message);
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
      await reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};