import fs from "fs";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;
const VIDEO_QUALITY = "720p";
const REQUEST_TIMEOUT = 120000;
const MAX_VIDEO_BYTES = 1500 * 1024 * 1024;
const VIDEO_AS_DOCUMENT_THRESHOLD = 70 * 1024 * 1024;

function safeFileName(name) {
  return String(name || "video")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video";
}

function normalizeMp4Name(name) {
  const clean = safeFileName(String(name || "video").replace(/\.mp4$/i, ""));
  return `${clean || "video"}.mp4`;
}

function stripExtension(name) {
  return String(name || "").replace(/\.[^.]+$/i, "");
}

function deleteFileSafe(fp) {
  try {
    if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {}
}

function extractYouTubeUrl(text) {
  const m = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i
  );
  return m ? m[0].trim() : "";
}

function isHttpUrl(v) {
  return /^https?:\/\//i.test(String(v || ""));
}

function parseContentDisposition(h) {
  const t = String(h || "");
  const u = t.match(/filename\*=UTF-8''([^;]+)/i);
  if (u?.[1]) {
    try { return decodeURIComponent(u[1]).replace(/["']/g, "").trim(); } catch {}
  }
  const n = t.match(/filename="?([^"]+)"?/i);
  return n?.[1]?.trim() || "";
}

async function readStreamToText(stream) {
  return new Promise((res, rej) => {
    let d = "";
    stream.on("data", (c) => (d += c.toString()));
    stream.on("end", () => res(d));
    stream.on("error", rej);
  });
}

async function searchYouTube(query) {
  console.log("[YTSEARCH] Buscando:", query);

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  const { data: html } = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    const title = video.title?.runs?.[0]?.text || "video";
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log("[YTSEARCH] Encontrado:", title, videoUrl);
    return { videoUrl, title: safeFileName(title), thumbnail };
  }

  throw new Error("No se encontraron videos para esa búsqueda.");
}

async function getVideoLink(videoUrl) {
  console.log("[YTMP4] Obteniendo link para:", videoUrl);

  const res = await axios.get(`${API_BASE}/ytmp4`, {
    params: {
      url: videoUrl,
      quality: VIDEO_QUALITY,
      apikey: APIKEY,
    },
    timeout: 60000,
    validateStatus: () => true,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      "x-api-key": APIKEY,
    },
  });

  console.log("[YTMP4] Status:", res.status);
  console.log("[YTMP4] Data:", JSON.stringify(res.data, null, 2));

  const d = res.data;
  if (res.status >= 400 || d?.ok === false) {
    throw new Error(d?.detail || d?.message || `HTTP ${res.status}`);
  }

  const dlUrl =
    d?.download_url_full ||
    d?.stream_url_full ||
    d?.download_url ||
    d?.stream_url ||
    d?.url || "";

  if (!dlUrl) throw new Error("La API no devolvió link de descarga.");

  return {
    dlUrl: dlUrl.startsWith("/") ? `${API_BASE}${dlUrl}` : dlUrl,
    title: safeFileName(d?.title || "video"),
    fileName: normalizeMp4Name(d?.filename || "video.mp4"),
    thumbnail: d?.thumbnail || null,
  };
}

async function downloadVideo(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: "stream",
    timeout: REQUEST_TIMEOUT,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
      Referer: `${API_BASE}/`,
      "x-api-key": APIKEY,
    },
    validateStatus: () => true,
    maxRedirects: 10,
  });

  if (response.status >= 400) {
    const err = await readStreamToText(response.data).catch(() => "");
    throw new Error(err || "Error al descargar el video.");
  }

  let downloaded = 0;
  response.data.on("data", (chunk) => {
    downloaded += chunk.length;
    if (downloaded > MAX_VIDEO_BYTES) {
      response.data.destroy(new Error("Video demasiado grande."));
    }
  });

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath));
  } catch (e) {
    deleteFileSafe(outputPath);
    throw e;
  }

  if (!fs.existsSync(outputPath)) throw new Error("No se pudo guardar el video.");

  const size = fs.statSync(outputPath).size;
  if (!size || size < 150000) {
    deleteFileSafe(outputPath);
    throw new Error("Video inválido o vacío.");
  }
  if (size > MAX_VIDEO_BYTES) {
    deleteFileSafe(outputPath);
    throw new Error("Video demasiado grande.");
  }

  const fromHeader = parseContentDisposition(response.headers?.["content-disposition"]);
  return {
    size,
    fileName: normalizeMp4Name(fromHeader || "video.mp4"),
  };
}

async function normalizeForWhatsApp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-vf", "scale=640:trunc(ow/a/2)*2",
      "-c:v", "libx264",
      "-b:v", "800k",
      "-preset", "fast",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-loglevel", "error",
      outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });

    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error("ffmpeg error"));
    });
  });
}

export default {
  name: "ytmp4",
  aliases: ["video", "yt"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quoted = { quoted: msg };

    const input = args.join(" ").trim();

    if (!input) {
      return reply(sock, jid,
        "❌ *Uso:*\n.ytmp4 <link YouTube>\n.video <nombre del video>",
        msg
      );
    }

    const rawFile   = path.join(TEMP_DIR, `yt_raw_${Date.now()}.mp4`);
    const finalFile = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`);

    try {
      let videoUrl  = extractYouTubeUrl(input);
      let title     = "video";
      let thumbnail = null;

      if (!videoUrl) {
        if (isHttpUrl(input)) {
          return reply(sock, jid, "❌ Envía un link válido de YouTube.", msg);
        }

        await reply(sock, jid, `🔍 Buscando: *${input}*...`, msg);

        const search = await searchYouTube(input);
        videoUrl  = search.videoUrl;
        title     = search.title;
        thumbnail = search.thumbnail;
      }

      if (thumbnail) {
        await reply(sock, jid,
`⬇️ *Descargando video...*
🎬 ${title}
🎚️ Calidad: ${VIDEO_QUALITY}
⏳ Espera un momento...`, msg);
      }

      const link = await getVideoLink(videoUrl);
      title = link.title || title;

      const videoInfo  = await downloadVideo(link.dlUrl, rawFile);
      const finalTitle = safeFileName(stripExtension(videoInfo.fileName) || title);
      const finalName  = normalizeMp4Name(finalTitle);
      const size       = videoInfo.size;

      // Enviar como documento si es muy grande
      if (size > VIDEO_AS_DOCUMENT_THRESHOLD) {
        await sock.sendMessage(jid, {
          document: { url: rawFile },
          mimetype: "video/mp4",
          fileName: finalName,
          caption: `🎬 ${finalTitle}\n🎚️ ${VIDEO_QUALITY}\n📦 Enviado como documento (archivo grande)`,
        }, quoted);
        return;
      }

      // Intentar enviar como video
      try {
        await sock.sendMessage(jid, {
          video: { url: rawFile },
          mimetype: "video/mp4",
          fileName: finalName,
          caption: `🎬 ${finalTitle}\n🎚️ ${VIDEO_QUALITY}`,
        }, quoted);
      } catch {
        // Fallback: normalizar con ffmpeg
        try {
          await normalizeForWhatsApp(rawFile, finalFile);
          const filePath = fs.existsSync(finalFile) ? finalFile : rawFile;
          const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : size;

          if (fileSize > VIDEO_AS_DOCUMENT_THRESHOLD) {
            await sock.sendMessage(jid, {
              document: { url: filePath },
              mimetype: "video/mp4",
              fileName: finalName,
              caption: `🎬 ${finalTitle}\n🎚️ ${VIDEO_QUALITY}\n📦 Enviado como documento`,
            }, quoted);
          } else {
            await sock.sendMessage(jid, {
              video: { url: filePath },
              mimetype: "video/mp4",
              fileName: finalName,
              caption: `🎬 ${finalTitle}\n🎚️ ${VIDEO_QUALITY}`,
            }, quoted);
          }
        } catch {
          // Último fallback como documento
          await sock.sendMessage(jid, {
            document: { url: rawFile },
            mimetype: "video/mp4",
            fileName: finalName,
            caption: `🎬 ${finalTitle}\n🎚️ ${VIDEO_QUALITY}`,
          }, quoted);
        }
      }

    } catch (e) {
      console.error("[YTMP4 ERROR]", e.message);
      const rawMsg = String(e?.message || "").toLowerCase();
      let humanMsg = `❌ ${e.message || "Error al descargar el video."}`;

      if (rawMsg.includes("bad gateway") || rawMsg.includes("502") || rawMsg.includes("503")) {
        humanMsg = "⚠️ El servidor de descargas está saturado.\n🔁 Intenta más tarde.";
      }

      await reply(sock, jid, humanMsg, msg);
    } finally {
      deleteFileSafe(rawFile);
      deleteFileSafe(finalFile);
    }
  },
};