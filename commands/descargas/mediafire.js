import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ✅ Carpeta temp DENTRO de tu proyecto (donde tienes 2.5 GB libres)
// Ajusta la ruta si tu estructura es diferente
const TEMP_DIR = path.join(__dirname, "../../temp_mf");

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

export default {
  name: "mediafire",
  aliases: ["mf", "mdf", "media"],

  run: async (sock, msg, args, jid) => {

    const url = extractMediafireUrl(args.join(" "));

    if (!url) {
      return sock.sendMessage(jid, {
        text: "❌ Envía un link válido de MediaFire.\n\nEjemplo:\n*.mf <url>*"
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: "🔎 Obteniendo información..."
    }, { quoted: msg });

    let filePath = null;

    try {
      const fileId = url.match(/\/file\/([^/]+)/)?.[1];
      if (!fileId) throw new Error("No pude extraer el ID del archivo.");

      const cleanUrl = `https://www.mediafire.com/file/${fileId}/file`;

      const { data } = await axios.get(APIURL, {
        params: { mode: "link", url: cleanUrl, apikey: APIKEY },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      if (!data?.ok) {
        throw new Error(data?.detail || data?.message || "La API no respondió.");
      }

      let directUrl =
        data.download_url_full ||
        data.stream_url_full ||
        data.download_url ||
        data.stream_url ||
        data.url;

      if (!directUrl) throw new Error("No encontré link de descarga.");
      if (directUrl.startsWith("/")) directUrl = `${process.env.DV_API_URL}${directUrl}`;

      const fileName  = safeFileName(data.filename || data.title || `archivo_${Date.now()}`);
      const ext       = data.extension ? `.${data.extension}` : path.extname(fileName) || ".bin";
      const finalName = fileName.endsWith(ext) ? fileName : fileName + ext;
      const extLower  = ext.toLowerCase();
      const fileSizeMB = parseFloat(String(data.filesize || "0").replace(/[^0-9.]/g, "")) || 0;

      await sock.sendMessage(jid, {
        text:
          `📦 *${finalName}*\n` +
          `📏 ${data.filesize || ""}\n\n` +
          `⬇️ Descargando al servidor...`
      }, { quoted: msg });

      // ── Descargar al disco del proyecto ───────────────────────
      await fs.ensureDir(TEMP_DIR);
      filePath = path.join(TEMP_DIR, `${Date.now()}_${finalName}`);

      const response = await axios.get(directUrl, {
        responseType: "stream",
        timeout: 300000,
        maxRedirects: 10,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "*/*",
          Referer: "https://www.mediafire.com/",
        },
      });

      await pipeline(response.data, fs.createWriteStream(filePath));

      const stats = await fs.stat(filePath);
      if (!stats.size || stats.size < 100) throw new Error("Archivo vacío o corrupto.");

      const mb = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`[MF] Descargado: ${finalName} (${mb} MB) en ${filePath}`);

      // ── Enviar a WhatsApp ──────────────────────────────────────
      const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const videoExts = [".mp4", ".mkv", ".avi", ".mov"];
      const audioExts = [".mp3", ".wav", ".ogg", ".m4a"];

      if (imageExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          image: { url: filePath },
          caption: `🖼️ *${finalName}*`,
        }, { quoted: msg });

      } else if (videoExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          video: { url: filePath },
          caption: `🎬 *${finalName}*`,
        }, { quoted: msg });

      } else if (audioExts.includes(extLower)) {
        await sock.sendMessage(jid, {
          audio: { url: filePath },
          mimetype: "audio/mpeg",
          ptt: false,
        }, { quoted: msg });

      } else {
        await sock.sendMessage(jid, {
          document: { url: filePath },
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

    } finally {
      // ── Borrar archivo apenas se envía ────────────────────────
      if (filePath) {
        try { await fs.unlink(filePath); } catch {}
      }
    }
  },
};