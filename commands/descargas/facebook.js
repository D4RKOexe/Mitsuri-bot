import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/facebook`;
const APIKEY = process.env.DV_API_KEY;

function extractFbUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i
  );
  return match ? match[0].trim() : null;
}

export default {
  name: "fb",
  aliases: ["facebook", "fbmp4"],
  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
    };

    const fbUrl = extractFbUrl(args.join(" "));

    if (!fbUrl) {
      await react("❌");
      return reply(sock, jid, "❌ Envía un link válido de Facebook.\nEj: `.fb https://fb.watch/abc`", msg);
    }

    await react("⏳");
    await reply(sock, jid, "⬇️ *Descargando Facebook...*", msg);
    await fs.ensureDir(TEMP_DIR);

    const output = path.join(TEMP_DIR, `fb_${Date.now()}.mp4`);

    try {
      // ── Consultar API ───────────────────────────────────────────────────
      const { data } = await axios.get(APIURL, {
        params: { url: fbUrl, quality: "auto", apikey: APIKEY },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      console.log("[FB] Respuesta:", JSON.stringify(data).slice(0, 200));

      if (!data?.ok) throw new Error(data?.detail || "La API no respondió correctamente.");

      const videoUrl = data.download_url_full || data.stream_url_full || data.download_url;
      if (!videoUrl) throw new Error("No encontré el link del video.");

      // ── Mostrar thumbnail si hay ────────────────────────────────────────
      if (data.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: data.thumbnail },
          caption:
            `🎬 *${data.title || "Facebook Video"}*\n` +
            (data.duration ? `⏱️ ${data.duration}\n` : "") +
            `⬇️ Descargando...`,
        }, { quoted: msg });
      }

      // ── Descargar video ─────────────────────────────────────────────────
      const response = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.facebook.com/" },
      });

      await pipeline(response.data, fs.createWriteStream(output));

      const stats = await fs.stat(output);
      if (!stats.size || stats.size < 100000) throw new Error("Video corrupto o vacío.");

      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      // ── Enviar video ────────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          video: { url: output },
          mimetype: "video/mp4",
          caption: `✅ *Facebook listo!*\n📦 ${sizeMB}MB`,
        }, { quoted: msg });
      } catch {
        // Fallback como documento si el video es muy grande
        await sock.sendMessage(jid, {
          document: { url: output },
          mimetype: "video/mp4",
          fileName: `facebook_${Date.now()}.mp4`,
          caption: `✅ *Facebook listo!*\n📦 ${sizeMB}MB\n📁 Enviado como documento`,
        }, { quoted: msg });
      }

      await react("✅");
      await fs.unlink(output);

    } catch (e) {
      if (await fs.pathExists(output)) await fs.unlink(output);
      console.error("[FB ERROR]", e.response?.data || e.message);
      await react("❌");
      await reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};