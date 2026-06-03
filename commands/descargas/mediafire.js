import axios from "axios";
import { Readable } from "stream";

const APIURL = `${process.env.DV_API_URL}/mediafire`;
const APIKEY = process.env.DV_API_KEY;

function extractMediafireUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?mediafire\.com\/[^\s]+/i
  );
  return match ? match[0].trim() : null;
}

function safeFileName(name) {
  return String(name || "mediafire_file")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Descarga la URL y devuelve un Buffer (sin tocar el disco)
async function urlToBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 300000,
    maxRedirects: 10,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "*/*",
      Referer: "https://www.mediafire.com/",
    },
  });
  return Buffer.from(response.data);
}

export default {
  name: "mediafire",
  aliases: ["mf", "mdf", "media"],

  run: async (sock, msg, args, jid) => {

    const url = extractMediafireUrl(args.join(" "));

    if (!url) {
      return sock.sendMessage(jid, {
        text: "❌ Envía un link válido de MediaFire.\n\nEjemplo:\n.mf <url>"
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: "⬇️ Procesando MediaFire..."
    }, { quoted: msg });

    try {
      // Extraer ID y limpiar URL
      const fileId = url.match(/\/file\/([^/]+)/)?.[1];
      if (!fileId) throw new Error("No pude extraer el ID del archivo.");

      const cleanUrl = `https://www.mediafire.com/file/${fileId}/file`;

      // Consultar API
      const { data } = await axios.get(APIURL, {
        params: { mode: "link", url: cleanUrl, apikey: APIKEY },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      if (!data?.ok) {
        throw new Error(data?.detail || data?.message || "La API no respondió correctamente.");
      }

      let directUrl =
        data.download_url_full ||
        data.stream_url_full ||
        data.download_url ||
        data.stream_url ||
        data.url;

      if (!directUrl) throw new Error("No encontré link de descarga.");
      if (directUrl.startsWith("/")) directUrl = `${process.env.DV_API_URL}${directUrl}`;

      const fileName = safeFileName(data.filename || data.title || `mediafire_${Date.now()}`);
      const ext      = (data.extension ? `.${data.extension}` : require("path").extname(fileName)) || ".bin";
      const finalName = fileName.endsWith(ext) ? fileName : fileName + ext;
      const extLower  = ext.toLowerCase();

      const fileSizeMB = parseFloat(String(data.filesize || "0").replace(/[^0-9.]/g, "")) || 0;

      // Avisar si es grande
      if (fileSizeMB > 50) {
        await sock.sendMessage(jid, {
          text: `📦 Archivo: *${finalName}*\n📏 Tamaño: *${data.filesize}*\n\n⏳ Es grande, puede tardar un momento...`
        }, { quoted: msg });
      }

      // ── Descargar en memoria (sin disco) ──────────────────────
      const buffer = await urlToBuffer(directUrl);

      const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const videoExts = [".mp4", ".mkv", ".avi", ".mov"];
      const audioExts = [".mp3", ".wav", ".ogg", ".m4a"];

      if (imageExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          image: buffer,
          caption: `🖼️ *${finalName}*`,
        }, { quoted: msg });

      } else if (videoExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          video: buffer,
          caption: `🎬 *${finalName}*`,
        }, { quoted: msg });

      } else if (audioExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          audio: buffer,
          mimetype: "audio/mpeg",
          ptt: false,
        }, { quoted: msg });

      } else {
        await sock.sendMessage(jid, {
          document: buffer,
          mimetype: "application/octet-stream",
          fileName: finalName,
          caption: `📦 *${finalName}*\n📏 ${data.filesize || ""}`,
        }, { quoted: msg });
      }

    } catch (e) {
      console.error("[MEDIAFIRE ERROR]", e?.response?.data || e.message);

      const errorMsg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e.message ||
        "Error desconocido";

      await sock.sendMessage(jid, {
        text: `❌ *Error:* ${errorMsg}`
      }, { quoted: msg });
    }
  },
};