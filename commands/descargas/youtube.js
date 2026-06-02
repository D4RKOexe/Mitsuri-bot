import fs from "fs";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";

const API_BASE      = "https://dv-yer-api.online";
const APIKEY        = "dvyer160439577387";
const REQUEST_TIMEOUT = 120000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const AUDIO_QUALITY = "128k";

function safeFileName(name) {
  return String(name || "audio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "audio";
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp); } catch (err) {
    console.warn("[CLEANUP]", err.message);
  }
}

function extractYouTubeUrl(text) {
  const m = String(text || "").match(/https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i);
  return m ? m[0].trim() : "";
}

function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || "")); }

function detectAudioType(fp) {
  try {
    const fd  = fs.openSync(fp, "r");
    const buf = Buffer.alloc(16);
    const n   = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const h = buf.subarray(0, n);
    if (h.length >= 8 && h.subarray(4, 8).toString("ascii") === "ftyp") return { ext: "m4a", mime: "audio/mp4",  isMp3: false };
    if (h.length >= 3 && h.subarray(0, 3).toString("ascii") === "ID3")  return { ext: "mp3", mime: "audio/mpeg", isMp3: true  };
    if (h.length >= 2 && h[0] === 0xff && (h[1] & 0xe0) === 0xe0)       return { ext: "mp3", mime: "audio/mpeg", isMp3: true  };
    if (h.length >= 4 && h[0] === 0x1a && h[1] === 0x45)                return { ext: "webm",mime: "audio/webm", isMp3: false };
  } catch {}
  return null;
}

function parseContentDisposition(h) {
  const t  = String(h || "");
  const u  = t.match(/filename\*=UTF-8''([^;]+)/i);
  if (u?.[1]) { try { return decodeURIComponent(u[1]).replace(/["']/g, "").trim(); } catch {} }
  const n  = t.match(/filename="?([^";\n]+)"?/i);
  return n?.[1]?.trim() || "";
}

async function searchYouTube(query) {
  console.log("[YTSEARCH] Buscando:", query);
  const { data: html } = await axios.get(
    "https://www.youtube.com/results?search_query=" + encodeURIComponent(query),
    { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es-ES,es;q=0.9" } }
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
    console.log("[YTSEARCH] Encontrado:", video.title?.runs?.[0]?.text, "https://www.youtube.com/watch?v=" + video.videoId);
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
  const fullUrl = API_BASE + "/ytmp3?url=" + encodeURIComponent(videoUrl) + "&quality=" + AUDIO_QUALITY + "&apikey=" + APIKEY;
  console.log("[YTMP3] URL completa:", fullUrl);
  const res = await axios.get(fullUrl, {
    timeout: 60000,
    validateStatus: () => true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "x-api-key": APIKEY,
      "Referer": "https://dv-yer-api.online/",
      "Origin": "https://dv-yer-api.online",
      "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
  });
  console.log("[YTMP3] Status:", res.status, "| Response:", JSON.stringify(res.data).slice(0, 200));
  const d = res.data || {};
  if (res.status >= 400 || d?.ok !== true)
    throw new Error(d?.detail || d?.message || d?.error || "HTTP " + res.status);
  const dlUrl = d?.download_url_full || d?.stream_url_full || d?.download_url || d?.stream_url || d?.url || "";
  if (!dlUrl) throw new Error("La API no devolvio link de descarga.");
  return {
    dlUrl:     dlUrl.startsWith("/") ? API_BASE + dlUrl : dlUrl,
    title:     safeFileName(d?.title || "audio"),
    fileName:  d?.filename || "audio.mp3",
    thumbnail: d?.thumbnail || null,
    quality:   d?.quality   || AUDIO_QUALITY,
    expiresIn: d?.expires_in_hint_seconds || 1200,
  };
}

async function downloadAudio(downloadUrl, outputPath) {
  console.log("[DOWNLOAD] Descargando desde:", downloadUrl);
  const response = await axios.get(downloadUrl, {
    responseType: "stream",
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*", "x-api-key": APIKEY },
    validateStatus: () => true,
    maxRedirects: 10,
  });
  if (response.status >= 400) throw new Error("Error HTTP " + response.status + " al descargar.");
  let downloaded = 0;
  response.data.on("data", chunk => {
    downloaded += chunk.length;
    if (downloaded > MAX_AUDIO_BYTES) response.data.destroy(new Error("Audio demasiado grande."));
  });
  try {
    await pipeline(response.data, fs.createWriteStream(outputPath));
  } catch (e) { deleteFileSafe(outputPath); throw e; }
  if (!fs.existsSync(outputPath)) throw new Error("El archivo no se guardo.");
  const size = fs.statSync(outputPath).size;
  if (size < 10000) { deleteFileSafe(outputPath); throw new Error("Audio invalido (" + size + " bytes)."); }
  console.log("[DOWNLOAD] OK:", size, "bytes");
  const detectedName = parseContentDisposition(response.headers?.["content-disposition"]);
  const sniffed = detectAudioType(outputPath);
  return {
    size,
    fileName: safeFileName(path.parse(detectedName || "audio").name || "audio") + "." + (sniffed?.ext || "mp3"),
    mime:     sniffed?.mime  || "audio/mpeg",
    isMp3:    sniffed?.isMp3 ?? true,
  };
}

async function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y", "-i", inputPath, "-vn", "-c:a", "libmp3lame",
      "-b:a", AUDIO_QUALITY, "-ar", "44100", "-ac", "2",
      "-map_metadata", "-1", "-loglevel", "error", outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", c => err += c.toString());
    ff.on("error", e => reject(e?.code === "ENOENT" ? new Error("ffmpeg no instalado.") : e));
    ff.on("close", code => code === 0 ? resolve() : reject(new Error(err.trim() || "ffmpeg error " + code)));
  });
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

    const sourceFile = path.join(TEMP_DIR, "yt_src_" + Date.now() + ".bin");
    const mp3File    = path.join(TEMP_DIR, "yt_mp3_" + Date.now() + ".mp3");

    try {
      let videoUrl  = extractYouTubeUrl(input);
      let title     = "audio";
      let thumbnail = null;

      if (!videoUrl) {
        if (isHttpUrl(input)) {
          try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
          return reply(sock, jid, "❌ Envia un link valido de YouTube.", msg);
        }
        await reply(sock, jid, "🔍 Buscando: *" + input + "*...", msg);
        const s = await searchYouTube(input);
        videoUrl  = s.videoUrl;
        title     = s.title;
        thumbnail = s.thumbnail;
      }

      // ── Primero obtener el link (así tenemos quality y expiresIn para el thumbnail)
      const audioLink = await getAudioLink(videoUrl);
      title = audioLink.title || title;

      // ── Ahora sí enviar el thumbnail con la info correcta
      if (thumbnail) {
        try {
          const expiresText = audioLink.expiresIn
            ? "⏰ Valido por: " + Math.round(audioLink.expiresIn / 60) + " min"
            : "";
          await sock.sendMessage(jid, {
            image:   { url: thumbnail },
            caption: "🎵 *Descargando audio...*\n🎧 " + title + "\n🎚️ Calidad: " + audioLink.quality + "\n" + expiresText + "\n⏳ Espera un momento...",
          }, quoted);
        } catch (err) {
          console.warn("[SEND] Error enviando thumbnail:", err.message);
          await reply(sock, jid, "🎵 *Descargando:* " + title + "\n⏳ Espera...", msg);
        }
      } else {
        await reply(sock, jid, "🎵 *Descargando:* " + title + "\n⏳ Espera...", msg);
      }

      // ── Descargar audio
      const audioInfo = await downloadAudio(audioLink.dlUrl, sourceFile);

      let fileToSend     = sourceFile;
      let fileNameToSend = audioInfo.fileName || safeFileName(title) + ".mp3";
      let mimeToSend     = audioInfo.mime;

      // ── Convertir si no es MP3
      if (!audioInfo.isMp3) {
        try {
          await convertToMp3(sourceFile, mp3File);
          fileToSend     = mp3File;
          fileNameToSend = safeFileName(title) + ".mp3";
          mimeToSend     = "audio/mpeg";
        } catch (convErr) {
          console.error("[CONVERT ERROR]", convErr.message);
          await sock.sendMessage(jid, {
            document: { url: fileToSend },
            mimetype: mimeToSend,
            fileName: fileNameToSend,
            caption:  "🎵 " + title + "\n⚠️ (No se pudo convertir a MP3)",
          }, quoted);
          try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "⚠️", key: msg.key } }); } catch {}
          return;
        }
      }

      // ── Enviar como audio
      try {
        await sock.sendMessage(jid, {
          audio:    { url: fileToSend },
          mimetype: "audio/mpeg",
          ptt:      false,
          fileName: fileNameToSend,
        }, quoted);
      } catch {
        await sock.sendMessage(jid, {
          document: { url: fileToSend },
          mimetype: mimeToSend,
          fileName: fileNameToSend,
          caption:  "🎵 " + title,
        }, quoted);
      }

      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (err) {
      console.error("[YTMP3 ERROR]", err.message);
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
      const raw = String(err?.message || "").toLowerCase();
      let humanMsg = "❌ " + (err.message || "Error al descargar el audio.");
      if (raw.includes("bad gateway") || raw.includes("502") || raw.includes("503"))
        humanMsg = "⚠️ El servidor de descargas esta saturado.\n🔁 Intenta mas tarde.";
      if (raw.includes("403"))
        humanMsg = "⚠️ Error 403 — la API rechazo la peticion.\n🔑 Verifica DV_API_KEY";
      await reply(sock, jid, humanMsg, msg);
    } finally {
      deleteFileSafe(sourceFile);
      deleteFileSafe(mp3File);
    }
  },
};