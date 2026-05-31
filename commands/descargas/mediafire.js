import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

const TEMP_DIR = "./temp_mediafire";

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
        text: "❌ Envía un link válido de MediaFire.\n\nEjemplo:\n.mf <url>"
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: "⬇️ Descargando MediaFire..."
    }, { quoted: msg });

    await fs.ensureDir(TEMP_DIR);

    try {

      // EXTRAER SOLO EL ID
      const fileId = url.match(/\/file\/([^/]+)/)?.[1];

      if (!fileId) {
        throw new Error("No pude extraer el ID del archivo.");
      }

      // URL LIMPIA
      const cleanUrl = `https://www.mediafire.com/file/${fileId}/file`;

      console.log("[MF CLEAN URL]", cleanUrl);

      // CONSULTAR API
      const { data } = await axios.get(APIURL, {
        params: {
          mode: "link",
          url: cleanUrl,
          apikey: APIKEY,
        },
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      });

      console.log("[MF API]", data);

      if (!data?.ok) {
        throw new Error(
          data?.detail ||
          data?.message ||
          "La API no respondió correctamente."
        );
      }

      // OBTENER URL FINAL
      let directUrl =
        data.download_url_full ||
        data.stream_url_full ||
        data.download_url ||
        data.stream_url ||
        data.url;

      if (!directUrl) {
        throw new Error("No encontré link de descarga.");
      }

      // SI VIENE RELATIVA
      if (directUrl.startsWith("/")) {
        directUrl = `${process.env.DV_API_URL}${directUrl}`;
      }

      console.log("[MF FINAL URL]", directUrl);

      // NOMBRE
      const fileName = safeFileName(
        data.filename ||
        data.title ||
        `mediafire_${Date.now()}`
      );

      const ext =
        path.extname(fileName) ||
        `.${data.extension || "bin"}`;

      const finalName = fileName.endsWith(ext)
        ? fileName
        : fileName + ext;

      const filePath = path.join(
        TEMP_DIR,
        finalName
      );

      // DESCARGAR
      const response = await axios.get(directUrl, {
        responseType: "stream",
        timeout: 300000,
        maxRedirects: 10,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "*/*",
          Referer: "https://www.mediafire.com/",
        },
      });

      await pipeline(
        response.data,
        fs.createWriteStream(filePath)
      );

      // VALIDAR
      const stats = await fs.stat(filePath);

      if (!stats.size || stats.size < 1000) {
        throw new Error("Archivo vacío o corrupto.");
      }

      console.log(
        `[MF] Archivo descargado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
      );

      const extLower = ext.toLowerCase();

      const imageExts = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp"
      ];

      const videoExts = [
        ".mp4",
        ".mkv",
        ".avi",
        ".mov"
      ];

      const audioExts = [
        ".mp3",
        ".wav",
        ".ogg",
        ".m4a"
      ];

      // ENVIAR
      if (imageExts.includes(extLower)) {

        await sock.sendMessage(jid, {
          image: { url: filePath },
          caption: `🖼️ ${finalName}`,
        }, { quoted: msg });

      } else if (videoExts.includes(extLower)) {

        await sock.sendMessage(jid, {
          video: { url: filePath },
          caption: `🎬 ${finalName}`,
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
          caption: `📦 ${finalName}`,
        }, { quoted: msg });

      }

      // BORRAR
      await fs.unlink(filePath);

    } catch (e) {

      console.error(
        "[MEDIAFIRE ERROR]",
        e?.response?.data || e.message
      );

      const errorMsg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e.message ||
        "Error desconocido";

      await sock.sendMessage(jid, {
        text: `❌ ${errorMsg}`
      }, { quoted: msg });

    } finally {

      try {
        await fs.emptyDir(TEMP_DIR);
      } catch {}

    }
  },
};