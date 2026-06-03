import axios from "axios";
import path from "path";

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
      const fileSizeMB = parseFloat(String(data.filesize || "0").replace(/[^0-9.]/g, "")) || 0;

      // Archivos pequeños (≤ 40MB) → intentar enviar directo via Baileys URL
      // Archivos grandes (> 40MB)  → solo link, tu servidor no aguanta
      if (fileSizeMB <= 40) {
        const extLower  = ext.toLowerCase();
        const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
        const videoExts = [".mp4", ".mkv", ".avi", ".mov"];
        const audioExts = [".mp3", ".wav", ".ogg", ".m4a"];

        try {
          if (imageExts.includes(extLower)) {
            return await sock.sendMessage(jid, {
              image: { url: directUrl },
              caption: `🖼️ *${finalName}*`,
            }, { quoted: msg });

          } else if (videoExts.includes(extLower)) {
            return await sock.sendMessage(jid, {
              video: { url: directUrl },
              caption: `🎬 *${finalName}*`,
            }, { quoted: msg });

          } else if (audioExts.includes(extLower)) {
            return await sock.sendMessage(jid, {
              audio: { url: directUrl },
              mimetype: "audio/mpeg",
              ptt: false,
            }, { quoted: msg });

          } else {
            return await sock.sendMessage(jid, {
              document: { url: directUrl },
              mimetype: "application/octet-stream",
              fileName: finalName,
              caption: `📦 *${finalName}*\n📏 ${data.filesize || ""}`,
            }, { quoted: msg });
          }

        } catch (sendErr) {
          // Si falla el envío directo, caer al link igual
          console.error("[MF SEND ERROR]", sendErr.message);
        }
      }

      // Archivo grande o fallo de envío → mandar link directo
      await sock.sendMessage(jid, {
        text:
          `✅ *Archivo encontrado*\n\n` +
          `📄 *Nombre:* ${finalName}\n` +
          `📏 *Tamaño:* ${data.filesize || "desconocido"}\n` +
          `📦 *Formato:* ${(data.format || ext).toUpperCase()}\n\n` +
          `🔗 *Link de descarga:*\n${directUrl}\n\n` +
          `> ⏳ _El link expira en ~20 minutos_`
      }, { quoted: msg });

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