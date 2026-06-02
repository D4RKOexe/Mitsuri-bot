import fs from "fs";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const APIKEY = "dvyer160439577387";
const REQUEST_TIMEOUT = 120000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const AUDIO_QUALITY = "128k";
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Connection": "keep-alive",
  "DNT": "1",
  "Upgrade-Insecure-Requests": "1",
  "Referer": "https://www.google.com/",
  "Origin": "https://www.google.com/"
};

/**
 * Genera un nombre de archivo seguro eliminando caracteres inválidos
 */
function safeFileName(name) {
  return String(name || "audio")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "audio";
}

/**
 * Elimina un archivo de forma segura sin lanzar excepciones
 */
function deleteFileSafe(fp) {
  try {
    if (fp && fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
  } catch (err) {
    console.warn(`[CLEANUP] No se pudo eliminar ${fp}:`, err.message);
  }
}

/**
 * Extrae URL de YouTube del texto
 */
function extractYouTubeUrl(text) {
  const regex = /https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i;
  const match = String(text || "").match(regex);
  return match ? match[0].trim() : "";
}

/**
 * Verifica si es una URL HTTP válida
 */
function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

/**
 * Detecta el tipo de audio basado en la firma del archivo
 */
function detectAudioType(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    const header = buf.subarray(0, bytesRead);

    // M4A (ftyp signature)
    if (header.length >= 8 && header.subarray(4, 8).toString("ascii") === "ftyp") {
      return { ext: "m4a", mime: "audio/mp4", isMp3: false };
    }

    // MP3 (ID3 tag)
    if (header.length >= 3 && header.subarray(0, 3).toString("ascii") === "ID3") {
      return { ext: "mp3", mime: "audio/mpeg", isMp3: true };
    }

    // MP3 (MPEG frame sync)
    if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0) {
      return { ext: "mp3", mime: "audio/mpeg", isMp3: true };
    }

    // WebM
    if (header.length >= 4 && header[0] === 0x1a && header[1] === 0x45) {
      return { ext: "webm", mime: "audio/webm", isMp3: false };
    }
  } catch (err) {
    console.warn("[DETECT] Error detectando tipo de audio:", err.message);
  }

  return null;
}

/**
 * Extrae el nombre del archivo del header Content-Disposition
 */
function parseContentDisposition(headerValue) {
  const header = String(headerValue || "");

  // UTF-8 encoded filename
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "").trim();
    } catch (err) {
      console.warn("[PARSE] Error decodificando UTF-8:", err.message);
    }
  }

  // Standard filename
  const nameMatch = header.match(/filename="?([^";\n]+)"?/i);
  return nameMatch?.[1]?.trim() || "";
}

/**
 * Busca un video en YouTube por término de búsqueda
 */
async function searchYouTube(query) {
  if (!query || query.trim().length === 0) {
    throw new Error("La consulta de búsqueda no puede estar vacía.");
  }

  console.log("[YTSEARCH] Buscando:", query);

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const { data: html } = await axios.get(searchUrl, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });

    if (!html || html.length === 0) {
      throw new Error("No se recibió respuesta de YouTube.");
    }

    const match = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!match?.[1]) {
      throw new Error("No se pudo obtener datos de YouTube.");
    }

    let ytData;
    try {
      ytData = JSON.parse(match[1]);
    } catch (parseErr) {
      throw new Error("Error al parsear respuesta de YouTube.");
    }

    const contents =
      ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    if (!Array.isArray(contents) || contents.length === 0) {
      throw new Error("No se encontraron videos para esa búsqueda.");
    }

    for (const item of contents) {
      const video = item?.videoRenderer;
      if (!video?.videoId) continue;

      const videoId = video.videoId;
      const title = video.title?.runs?.[0]?.text || "audio";
      const thumbnail = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log("[YTSEARCH] Encontrado:", title, videoUrl);
      return {
        videoUrl,
        title: safeFileName(title),
        thumbnail,
      };
    }

    throw new Error("No se encontraron videos válidos.");
  } catch (err) {
    console.error("[YTSEARCH ERROR]", err.message);
    throw new Error(`Error en búsqueda de YouTube: ${err.message}`);
  }
}

/**
 * Obtiene el enlace de descarga de MP3 desde la API
 */
async function getAudioLink(videoUrl) {
  if (!videoUrl || !isHttpUrl(videoUrl)) {
    throw new Error("URL de video inválida.");
  }

  console.log("[YTMP3] Obteniendo link para:", videoUrl);

  try {
    const response = await axios.get(`${API_BASE}/ytmp3`, {
      params: {
        url: videoUrl,
        quality: AUDIO_QUALITY,
        apikey: APIKEY,
      },
      timeout: 60000,
      validateStatus: () => true,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "x-api-key": APIKEY,
      },
    });

    console.log("[YTMP3] Status:", response.status);

    const data = response.data || {};

    // Validar respuesta exitosa
    if (response.status >= 400) {
      const errorMsg = data?.detail || data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    // Validar que ok sea true
    if (data?.ok !== true) {
      const errorMsg = data?.detail || data?.message || data?.error || "API retornó ok: false";
      throw new Error(errorMsg);
    }

    // Priorizar download_url_full (URL más confiable)
    const downloadUrl =
      data?.download_url_full ||
      data?.stream_url_full ||
      data?.download_url ||
      data?.stream_url ||
      data?.url ||
      "";

    if (!downloadUrl || downloadUrl.trim().length === 0) {
      throw new Error("La API no devolvió un enlace de descarga válido.");
    }

    // Validar que la URL sea correcta
    if (!isHttpUrl(downloadUrl)) {
      throw new Error("URL de descarga inválida.");
    }

    const audioInfo = {
      dlUrl: downloadUrl,
      title: safeFileName(data?.title || "audio"),
      fileName: data?.filename || "audio.mp3",
      thumbnail: data?.thumbnail || null,
      format: data?.format || "MP3",
      quality: data?.quality || AUDIO_QUALITY,
      source: data?.source || "youtube",
      expiresIn: data?.expires_in_hint_seconds || 1200,
    };

    console.log("[YTMP3] Respuesta válida:", {
      title: audioInfo.title,
      format: audioInfo.format,
      quality: audioInfo.quality,
      expiresIn: audioInfo.expiresIn,
    });

    return audioInfo;
  } catch (err) {
    console.error("[YTMP3 ERROR]", err.message);
    throw new Error(`Error obteniendo audio: ${err.message}`);
  }
}

/**
 * Descarga el archivo de audio desde la URL
 */
async function downloadAudio(downloadUrl, outputPath, timeout = REQUEST_TIMEOUT) {
  if (!downloadUrl || !isHttpUrl(downloadUrl)) {
    throw new Error("URL de descarga inválida.");
  }

  if (!outputPath) {
    throw new Error("Ruta de salida no especificada.");
  }

  console.log("[DOWNLOAD] Descargando desde:", downloadUrl);

  try {
    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      timeout: timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "x-api-key": APIKEY,
        "Referer": "https://www.youtube.com/",
      },
      validateStatus: () => true,
      maxRedirects: 10,
    });

    if (response.status >= 400) {
      const statusText = response.statusText || "Unknown";
      throw new Error(`Error HTTP ${response.status} (${statusText})`);
    }

    let downloadedBytes = 0;
    const contentLength = parseInt(response.headers?.["content-length"] || "0", 10);

    console.log("[DOWNLOAD] Tamaño esperado:", contentLength, "bytes");

    // Monitorear descarga
    response.data.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      const percent = contentLength ? Math.round((downloadedBytes / contentLength) * 100) : 0;
      console.log(`[DOWNLOAD] Progreso: ${downloadedBytes}/${contentLength} bytes (${percent}%)`);

      if (downloadedBytes > MAX_AUDIO_BYTES) {
        response.data.destroy(new Error("Audio excede el tamaño máximo permitido."));
      }
    });

    response.data.on("error", (err) => {
      console.error("[DOWNLOAD STREAM ERROR]", err.message);
      deleteFileSafe(outputPath);
    });

    try {
      await pipeline(response.data, fs.createWriteStream(outputPath));
    } catch (pipelineErr) {
      deleteFileSafe(outputPath);
      throw new Error(`Error en descarga: ${pipelineErr.message}`);
    }

    // Validar que el archivo se guardó correctamente
    if (!fs.existsSync(outputPath)) {
      throw new Error("El archivo no se guardó correctamente.");
    }

    const fileStats = fs.statSync(outputPath);
    const fileSize = fileStats.size;

    if (!fileSize || fileSize < 10000) {
      deleteFileSafe(outputPath);
      throw new Error(`Audio inválido o demasiado pequeño (${fileSize} bytes).`);
    }

    console.log("[DOWNLOAD] Archivo descargado correctamente:", fileSize, "bytes");

    // Detectar tipo de audio
    const detectedFileName = parseContentDisposition(response.headers?.["content-disposition"]);
    const audioTypeInfo = detectAudioType(outputPath);
    const extension = audioTypeInfo?.ext || "mp3";
    const baseName = safeFileName(path.parse(detectedFileName || "audio").name || "audio");
    const mimeType = audioTypeInfo?.mime || "audio/mpeg";
    const isMp3 = audioTypeInfo?.isMp3 ?? true;

    return {
      size: fileSize,
      fileName: `${baseName}.${extension}`,
      mime: mimeType,
      isMp3,
      extension,
    };
  } catch (err) {
    deleteFileSafe(outputPath);
    console.error("[DOWNLOAD ERROR]", err.message);
    throw new Error(`Fallo en descarga: ${err.message}`);
  }
}

/**
 * Convierte audio a MP3 usando FFmpeg
 */
async function convertToMp3(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error("Archivo de entrada no encontrado.");
  }

  console.log("[CONVERT] Convirtiendo a MP3:", inputPath);

  return new Promise((reject, resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      AUDIO_QUALITY,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-map_metadata",
      "-1",
      "-loglevel",
      "error",
      outputPath,
    ], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderrOutput = "";

    ffmpeg.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });

    ffmpeg.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("FFmpeg no está instalado. Instálalo para convertir audio."));
      } else {
        reject(new Error(`Error de FFmpeg: ${err.message}`));
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log("[CONVERT] Conversión completada.");
        resolve();
      } else {
        const errorMsg = stderrOutput.trim() || `FFmpeg salió con código ${code}`;
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Validar que TEMP_DIR existe
 */
function ensureTempDir() {
  if (!TEMP_DIR) {
    throw new Error("TEMP_DIR no está configurado.");
  }
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  } catch (err) {
    throw new Error(`No se pudo crear directorio temporal: ${err.message}`);
  }
}

/**
 * Módulo principal del comando
 */
export default {
  name: "ytmp3",
  aliases: ["play", "mp3", "song"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quoted = { quoted: msg };
    const input = args.join(" ").trim();

    // Reacción de carga
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        react: { text: "⏳", key: msg.key },
      });
    } catch (err) {
      console.warn("[REACT] Error enviando reacción:", err.message);
    }

    // Validar entrada
    if (!input || input.length === 0) {
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: "❌", key: msg.key },
        });
      } catch (err) {
        console.warn("[REACT] Error enviando reacción:", err.message);
      }
      return reply(
        sock,
        jid,
        "❌ *Uso:*\n.play <nombre de canción>\n.play <link de YouTube>",
        msg
      );
    }

    // Validar directorio temporal
    try {
      ensureTempDir();
    } catch (err) {
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: "❌", key: msg.key },
        });
      } catch {}
      return reply(sock, jid, `❌ Error de configuración: ${err.message}`, msg);
    }

    const sourceFile = path.join(TEMP_DIR, `yt_src_${Date.now()}.bin`);
    const mp3File = path.join(TEMP_DIR, `yt_mp3_${Date.now()}.mp3`);

    try {
      let videoUrl = extractYouTubeUrl(input);
      let title = "audio";
      let thumbnail = null;

      // Si no es URL de YouTube, buscar
      if (!videoUrl) {
        if (isHttpUrl(input)) {
          try {
            await sock.sendMessage(msg.key.remoteJid, {
              react: { text: "❌", key: msg.key },
            });
          } catch (err) {
            console.warn("[REACT] Error enviando reacción:", err.message);
          }
          return reply(sock, jid, "❌ Envía un link válido de YouTube.", msg);
        }

        // Buscar en YouTube
        try {
          await reply(sock, jid, `🔍 Buscando: *${input}*...`, msg);
          const searchResult = await searchYouTube(input);
          videoUrl = searchResult.videoUrl;
          title = searchResult.title;
          thumbnail = searchResult.thumbnail;
        } catch (searchErr) {
          try {
            await sock.sendMessage(msg.key.remoteJid, {
              react: { text: "❌", key: msg.key },
            });
          } catch (err) {
            console.warn("[REACT] Error enviando reacción:", err.message);
          }
          return reply(sock, jid, `❌ ${searchErr.message}`, msg);
        }
      }

      // Enviar estado de descarga
      if (thumbnail) {
        try {
          const expiresText = audioLink.expiresIn 
            ? `⏰ Válido por: ${Math.round(audioLink.expiresIn / 60)} min` 
            : "";
          await sock.sendMessage(jid, {
            image: { url: thumbnail },
            caption: `🎵 *Descargando audio...*\n🎧 ${title}\n🎚️ Calidad: ${audioLink.quality}\n${expiresText}\n⏳ Espera un momento...`,
          }, quoted);
        } catch (err) {
          console.warn("[SEND] Error enviando thumbnail:", err.message);
          await reply(sock, jid, `🎵 *Descargando:* ${title}\n⏳ Espera...`, msg);
        }
      } else {
        await reply(sock, jid, `🎵 *Descargando:* ${title}\n⏳ Espera...`, msg);
      }

      // Obtener link de descarga
      let audioLink;
      try {
        audioLink = await getAudioLink(videoUrl);
        title = audioLink.title || title;
      } catch (linkErr) {
        try {
          await sock.sendMessage(msg.key.remoteJid, {
            react: { text: "❌", key: msg.key },
          });
        } catch (err) {
          console.warn("[REACT] Error enviando reacción:", err.message);
        }
        return reply(sock, jid, `❌ ${linkErr.message}`, msg);
      }

      // Descargar audio
      let audioInfo;
      try {
        audioInfo = await downloadAudio(audioLink.dlUrl, sourceFile);
      } catch (downloadErr) {
        try {
          await sock.sendMessage(msg.key.remoteJid, {
            react: { text: "❌", key: msg.key },
          });
        } catch (err) {
          console.warn("[REACT] Error enviando reacción:", err.message);
        }
        return reply(sock, jid, `❌ ${downloadErr.message}`, msg);
      }

      let fileToSend = sourceFile;
      let fileNameToSend = audioInfo.fileName || `${safeFileName(title)}.mp3`;
      let mimeToSend = audioInfo.mime;

      // Convertir a MP3 si es necesario
      if (!audioInfo.isMp3) {
        try {
          console.log("[CONVERT] Iniciando conversión a MP3...");
          await convertToMp3(sourceFile, mp3File);
          fileToSend = mp3File;
          fileNameToSend = `${safeFileName(title)}.mp3`;
          mimeToSend = "audio/mpeg";
        } catch (convertErr) {
          console.error("[CONVERT ERROR]", convertErr.message);

          // Enviar como documento si falla la conversión
          try {
            await sock.sendMessage(jid, {
              document: { url: fileToSend },
              mimetype: mimeToSend,
              fileName: fileNameToSend,
              caption: `🎵 ${title}\n⚠️ (No se pudo convertir a MP3)`,
            }, quoted);
          } catch (sendErr) {
            console.error("[SEND ERROR]", sendErr.message);
            await reply(
              sock,
              jid,
              `❌ Error al enviar audio: ${sendErr.message}`,
              msg
            );
            return;
          }

          try {
            await sock.sendMessage(msg.key.remoteJid, {
              react: { text: "⚠️", key: msg.key },
            });
          } catch (err) {
            console.warn("[REACT] Error enviando reacción:", err.message);
          }
          return;
        }
      }

      // Enviar audio
      let sendSuccess = false;

      // Intentar enviar como audio
      try {
        await sock.sendMessage(jid, {
          audio: { url: fileToSend },
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: fileNameToSend,
        }, quoted);
        sendSuccess = true;
      } catch (audioErr) {
        console.warn("[SEND AUDIO] Error enviando como audio:", audioErr.message);

        // Fallback: enviar como documento
        try {
          await sock.sendMessage(jid, {
            document: { url: fileToSend },
            mimetype: mimeToSend,
            fileName: fileNameToSend,
            caption: `🎵 ${title}`,
          }, quoted);
          sendSuccess = true;
        } catch (docErr) {
          console.error("[SEND DOCUMENT] Error enviando documento:", docErr.message);
          await reply(
            sock,
            jid,
            `❌ Error al enviar archivo: ${docErr.message}`,
            msg
          );
          return;
        }
      }

      if (sendSuccess) {
        try {
          await sock.sendMessage(msg.key.remoteJid, {
            react: { text: "✅", key: msg.key },
          });
        } catch (err) {
          console.warn("[REACT] Error enviando reacción:", err.message);
        }
      }
    } catch (err) {
      console.error("[YTMP3 ERROR]", err.message);

      try {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: "❌", key: msg.key },
        });
      } catch (reactionErr) {
        console.warn("[REACT] Error enviando reacción:", reactionErr.message);
      }

      const rawMsg = String(err?.message || "").toLowerCase();
      let humanMsg = `❌ ${err.message || "Error al descargar el audio."}`;

      if (
        rawMsg.includes("bad gateway") ||
        rawMsg.includes("502") ||
        rawMsg.includes("503") ||
        rawMsg.includes("saturado")
      ) {
        humanMsg =
          "⚠️ El servidor de descargas está saturado.\n🔁 Intenta más tarde.";
      }

      await reply(sock, jid, humanMsg, msg);
    } finally {
      // Limpiar archivos temporales
      deleteFileSafe(sourceFile);
      deleteFileSafe(mp3File);
    }
  },
};