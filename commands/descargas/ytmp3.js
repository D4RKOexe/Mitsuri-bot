import fs from "fs";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";

// ── API temporal: delirius.store ──────────────────────────
const DELIRIUS_BASE = "https://api.delirius.store/download";

const REQUEST_TIMEOUT = 120000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
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

function cleanYouTubeUrl(url) {
  return url
    .replace(/([?&])si=[^&]*/i, (m, sep) => sep === "?" ? "?" : "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || "")); }

function detectAudioType(fp) {
  try {
    const fd = fs.openSync(fp, "r");
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const s = buf.subarray(0, n);
    if (s.length >= 8 && s.subarray(4, 8).toString("ascii") === "ftyp") return { ext: "m4a", mime: "audio/mp4", isMp3: false };
    if (s.length >= 3 && s.subarray(0, 3).toString("ascii") === "ID3") return { ext: "mp3", mime: "audio/mpeg", isMp3: true };
    if (s.length >= 2 && s[0] === 0xff && (s[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg", isMp3: true };
    if (s.length >= 4 && s[0] === 0x1a && s[1] === 0x45) return { ext: "webm", mime: "audio/webm", isMp3: false };
  } catch {}
  return null;
}

async function searchYouTube(query) {
  console.log("[YTSEARCH] Buscando:", query);
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const { data: html } = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });

  const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
  if (!match) throw new Error("No se pudo obtener resultados de YouTube.");

  const ytData = JSON.parse(match[1]);
  const contents =
    ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

  for (const item of contents) {
    const video = item?.videoRenderer;
    if (!video?.videoId) continue;
    const videoId = video.videoId;
    const title = video.title?.runs?.[0]?.text || "audio";
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log("[YTSEARCH] Encontrado:", title, videoUrl);
    return { videoUrl, title: safeFileName(title), thumbnail };
  }

  throw new Error("No se encontraron videos para esa búsqueda.");
}

async function getAudioLink(videoUrl) {
  const cleanUrl = cleanYouTubeUrl(videoUrl);
  console.log("[YTMP3] Obteniendo link para:", cleanUrl);

  const res = await axios.get(`${DELIRIUS_BASE}/ytmp3`, {
    params: { url: cleanUrl },
    timeout: 60000,
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });

  console.log("[YTMP3] Status:", res.status);
  console.log("[YTMP3] Data:", JSON.stringify(res.data, null, 2));

  const d = res.data;
  if (res.status >= 400 || d?.status === false) {
    throw new Error(d?.message || d?.error || `HTTP ${res.status}`);
  }

  // Delirius puede responder en varias estructuras, cubrimos todas
  const dlUrl =
    d?.data?.url ||
    d?.data?.download ||
    d?.data?.audio ||
    d?.url ||
    d?.download ||
    d?.audio ||
    "";

  if (!dlUrl) throw new Error("La API no devolvió link de descarga.");

  const title = safeFileName(
    d?.data?.title || d?.title || "audio"
  );
  const thumbnail =
    d?.data?.thumbnail || d?.data?.image ||
    d?.thumbnail || d?.image || null;

  return { dlUrl, title, thumbnail };
}

async function downloadAudio(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: "stream",
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
    validateStatus: () => true,
    maxRedirects: 10,
  });

  if (response.status >= 400) throw new Error(`Error al descargar: HTTP ${response.status}`);

  let downloaded = 0;
  response.data.on("data", (chunk) => {
    downloaded += chunk.length;
    if (downloaded > MAX_AUDIO_BYTES) response.data.destroy(new Error("Audio demasiado grande."));
  });

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath));
  } catch (e) {
    deleteFileSafe(outputPath);
    throw e;
  }

  if (!fs.existsSync(outputPath)) throw new Error("No se pudo guardar el audio.");
  const size = fs.statSync(outputPath).size;
  if (!size || size < 10000) { deleteFileSafe(outputPath); throw new Error("Audio inválido o vacío."); }

  const sniffed = detectAudioType(outputPath);
  const ext = sniffed?.ext || "mp3";

  return { size, ext, mime: sniffed?.mime || "audio/mpeg", isMp3: sniffed?.isMp3 ?? true };
}

async function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y", "-i", inputPath, "-vn", "-c:a", "libmp3lame",
      "-b:a", AUDIO_QUALITY, "-ar", "44100", "-ac", "2",
      "-map_metadata", "-1", "-loglevel", "error", outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });

    let errText = "";
    ff.stderr.on("data", (c) => (errText += c.toString()));
    ff.on("error", (e) => reject(e?.code === "ENOENT" ? new Error("ffmpeg no instalado.") : e));
    ff.on("close", (code) => code === 0 ? resolve() : reject(new Error(errText.trim() || `ffmpeg error ${code}`)));
  });
}

export default {
  name: "ytmp3",
  aliases: ["play", "mp3", "song"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quoted = { quoted: msg };
    const input = args.join(" ").trim();

    try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }); } catch {}

    if (!input) {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
      return reply(sock, jid, "❌ *Uso:*\n.play <nombre de canción>\n.play <link de YouTube>", msg);
    }

    const sourceFile = path.join(TEMP_DIR, `yt_src_${Date.now()}.bin`);
    const mp3File    = path.join(TEMP_DIR, `yt_mp3_${Date.now()}.mp3`);

    try {
      let videoUrl  = extractYouTubeUrl(input);
      let title     = "audio";
      let thumbnail = null;

      if (!videoUrl) {
        if (isHttpUrl(input)) {
          try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}
          return reply(sock, jid, "❌ Envía un link válido de YouTube.", msg);
        }

        await reply(sock, jid, `🔍 Buscando: *${input}*...`, msg);
        const search = await searchYouTube(input);
        videoUrl  = search.videoUrl;
        title     = search.title;
        thumbnail = search.thumbnail;
      }

      if (thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: thumbnail },
          caption: `🎵 *Descargando audio...*\n🎧 ${title}\n🎚️ Calidad: ${AUDIO_QUALITY}\n⏳ Espera un momento...`,
        }, quoted);
      } else {
        await reply(sock, jid, `🎵 *Descargando:* ${title}\n⏳ Espera...`, msg);
      }

      const link = await getAudioLink(videoUrl);
      title = link.title || title;

      // Si thumbnail vino de delirius, actualizamos
      if (!thumbnail && link.thumbnail) {
        thumbnail = link.thumbnail;
      }

      const audioInfo    = await downloadAudio(link.dlUrl, sourceFile);
      let fileToSend     = sourceFile;
      let fileNameToSend = `${safeFileName(title)}.${audioInfo.ext}`;
      let mimeToSend     = audioInfo.mime;

      if (!audioInfo.isMp3) {
        try {
          await convertToMp3(sourceFile, mp3File);
          fileToSend     = mp3File;
          fileNameToSend = `${safeFileName(title)}.mp3`;
          mimeToSend     = "audio/mpeg";
        } catch (convErr) {
          console.error("[YTMP3 CONV ERROR]", convErr.message);
          // Fallback: enviar como documento en formato original
          await sock.sendMessage(jid, {
            document: { url: fileToSend },
            mimetype: mimeToSend,
            fileName: fileNameToSend,
            caption: `🎵 ${title}`,
          }, quoted);
          try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }); } catch {}
          return;
        }
      }

      try {
        await sock.sendMessage(jid, {
          audio: { url: fileToSend },
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: fileNameToSend,
        }, quoted);
      } catch {
        // Fallback como documento
        await sock.sendMessage(jid, {
          document: { url: fileToSend },
          mimetype: mimeToSend,
          fileName: fileNameToSend,
          caption: `🎵 ${title}`,
        }, quoted);
      }

      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (e) {
      console.error("[YTMP3 ERROR]", e.message);
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }); } catch {}

      const rawMsg = String(e?.message || "").toLowerCase();
      let humanMsg = `❌ ${e.message || "Error al descargar el audio."}`;
      if (rawMsg.includes("bad gateway") || rawMsg.includes("502") || rawMsg.includes("503") || rawMsg.includes("500")) {
        humanMsg = "⚠️ El servidor de descargas está saturado.\n🔁 Intenta más tarde.";
      }
      await reply(sock, jid, humanMsg, msg);
    } finally {
      deleteFileSafe(sourceFile);
      deleteFileSafe(mp3File);
    }
  },
};