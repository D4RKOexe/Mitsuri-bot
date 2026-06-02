import fs from "fs";
import path from "path";
import axios from "axios";
import { TEMP_DIR } from "../../config.js";

const API_BASE = "https://dv-yer-api.online";
const APIKEY   = "dvyer596245547941";
const AUDIO_QUALITY = "128k";

function safeFileName(name) {
  return String(name || "audio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "audio";
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
}

function extractYouTubeUrl(text) {
  const m = String(text || "").match(/https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i);
  return m ? m[0].trim() : "";
}

async function searchYouTube(query) {
  console.log("[YTSEARCH] Buscando:", query);
  const { data: html } = await axios.get(
    "https://www.youtube.com/results?search_query=" + encodeURIComponent(query),
    {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    }
  );
  const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
  if (!match) throw new Error("No se pudo obtener resultados de YouTube.");
  const contents =
    JSON.parse(match[1])?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents || [];
  for (const item of contents) {
    const video = item?.videoRenderer;
    if (!video?.videoId) continue;
    return {
      videoUrl:  "https://www.youtube.com/watch?v=" + video.videoId,
      title:     safeFileName(video.title?.runs?.[0]?.text || "audio"),
      thumbnail: "https://i.ytimg.com/vi/" + video.videoId + "/sddefault.jpg",
    };
  }
  throw new Error("No se encontraron videos para esa búsqueda.");
}

async function getAudioLink(videoUrl) {
  console.log("[YTMP3] Obteniendo link para:", videoUrl);
  const res = await axios.get(API_BASE + "/ytmp3", {
    params:  { url: videoUrl, quality: AUDIO_QUALITY, apikey: APIKEY },
    timeout: 60000,
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", "x-api-key": APIKEY },
  });
  console.log("[YTMP3] Status:", res.status);
  const d = res.data;
  if (res.status >= 400 || d?.ok === false)
    throw new Error(d?.detail || d?.message || "HTTP " + res.status);
  const dlUrl = d?.download_url_full || d?.stream_url_full || d?.download_url || d?.stream_url || d?.url || "";
  if (!dlUrl) throw new Error("La API no devolvio link de descarga.");
  return {
    dlUrl:    dlUrl.startsWith("/") ? API_BASE + dlUrl : dlUrl,
    title:    safeFileName(d?.title || "audio"),
    fileName: d?.filename || "audio.mp3",
    thumbnail: d?.thumbnail || null,
  };
}

export default {
  name: "ytmp3",
  aliases: ["play", "mp3", "song"],

  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quoted = { quoted: msg };
    const input  = args.join(" ").trim();

    try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }); } catch {}

    if (!input) {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
      return reply(sock, jid, "❌ *Uso:*\n.play <nombre de cancion>\n.play <link de YouTube>", msg);
    }

    const tmpFile = path.join(TEMP_DIR, "yt_" + Date.now() + ".mp3");

    try {
      let videoUrl  = extractYouTubeUrl(input);
      let title     = "audio";
      let thumbnail = null;

      if (!videoUrl) {
        await reply(sock, jid, "🔍 Buscando: *" + input + "*...", msg);
        const search = await searchYouTube(input);
        videoUrl  = search.videoUrl;
        title     = search.title;
        thumbnail = search.thumbnail;
      }

      if (thumbnail) {
        await sock.sendMessage(jid, {
          image:   { url: thumbnail },
          caption: "🎵 *Descargando audio...*\n🎧 " + title + "\n🎚️ Calidad: " + AUDIO_QUALITY + "\n⏳ Espera un momento...",
        }, quoted);
      } else {
        await reply(sock, jid, "🎵 *Descargando:* " + title + "\n⏳ Espera...", msg);
      }

      const link = await getAudioLink(videoUrl);
      title = link.title || title;

      // Descargar con x-api-key en el header
      console.log("[YTMP3] Descargando desde:", link.dlUrl);
      const response = await axios.get(link.dlUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
          "x-api-key": APIKEY,
        },
        validateStatus: () => true,
        maxRedirects: 10,
      });

      if (response.status >= 400)
        throw new Error("Error al descargar audio: HTTP " + response.status);

      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(tmpFile);
        response.data.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
        response.data.on("error", reject);
      });

      const size = fs.existsSync(tmpFile) ? fs.statSync(tmpFile).size : 0;
      if (size < 10000) throw new Error("Audio invalido o demasiado pequeño.");
      console.log("[YTMP3] Descargado:", size, "bytes");

      const rawName = link.fileName || (safeFileName(title) + ".mp3");
      const fileName = rawName.endsWith(".mp3") ? rawName : rawName + ".mp3";

      try {
        await sock.sendMessage(jid, {
          audio:    { url: tmpFile },
          mimetype: "audio/mpeg",
          ptt:      false,
          fileName,
        }, quoted);
      } catch {
        await sock.sendMessage(jid, {
          document: { url: tmpFile },
          mimetype: "audio/mpeg",
          fileName,
          caption:  "🎵 " + title,
        }, quoted);
      }

      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (e) {
      console.error("[YTMP3 ERROR]", e.message);
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
      const raw = String(e?.message || "").toLowerCase();
      let humanMsg = "❌ " + (e.message || "Error al descargar el audio.");
      if (raw.includes("bad gateway") || raw.includes("502") || raw.includes("503"))
        humanMsg = "⚠️ El servidor de descargas esta saturado.\n🔁 Intenta mas tarde.";
      if (raw.includes("403"))
        humanMsg = "⚠️ Error de autenticacion con la API (403).\n🔑 Verifica tu DV_API_KEY en el .env";
      await reply(sock, jid, humanMsg, msg);
    } finally {
      deleteFileSafe(tmpFile);
    }
  },
};