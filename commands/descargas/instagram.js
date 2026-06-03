import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/instagram`;
const APIKEY = process.env.DV_API_KEY;

function extractIgUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
  );
  return match ? match[0].trim() : null;
}

export default {
  name: "ig",
  aliases: ["instagram", "reel", "igdl"],

  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
    };

    const igUrl = extractIgUrl(args.join(" "));

    if (!igUrl) {
      await react("❌");
      return reply(sock, jid, "❌ Envía un link válido de Instagram.\nEj: `.ig https://www.instagram.com/reel/abc`", msg);
    }

    await react("⏳");
    await reply(sock, jid, "⬇️ *Descargando Instagram...*", msg);
    await fs.ensureDir(TEMP_DIR);

    const output = path.join(TEMP_DIR, `ig_${Date.now()}.mp4`);

    try {
      // ── Consultar API ──────────────────────────────────────────
      const { data } = await axios.get(APIURL, {
        params: { url: igUrl, apikey: APIKEY },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      console.log("[IG] Respuesta:", JSON.stringify(data).slice(0, 200));

      if (!data?.ok) throw new Error(data?.detail || "La API no respondió correctamente.");

      const videoUrl = data.download_url_full || data.stream_url_full || data.download_url;
      if (!videoUrl) throw new Error("No encontré el link del video.");

      // ── Thumbnail si hay ───────────────────────────────────────
      if (data.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: data.thumbnail },
          caption:
            `📸 *${data.title || "Instagram"}*\n` +
            (data.duration ? `⏱️ ${data.duration}\n` : "") +
            `⬇️ Descargando...`,
        }, { quoted: msg });
      }

      // ── Descargar ──────────────────────────────────────────────
      const response = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.instagram.com/" },
      });

      await pipeline(response.data, fs.createWriteStream(output));

      const stats = await fs.stat(output);
      if (!stats.size || stats.size < 10000) throw new Error("Video corrupto o vacío.");

      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      // ── Enviar ─────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          video: { url: output },
          mimetype: "video/mp4",
          caption: `✅ *Instagram listo!*\n📦 ${sizeMB} MB`,
        }, { quoted: msg });
      } catch {
        // Fallback como documento
        await sock.sendMessage(jid, {
          document: { url: output },
          mimetype: "video/mp4",
          fileName: `instagram_${Date.now()}.mp4`,
          caption: `✅ *Instagram listo!*\n📦 ${sizeMB} MB\n📁 Enviado como documento`,
        }, { quoted: msg });
      }

      await react("✅");
      await fs.unlink(output);

    } catch (e) {
      if (await fs.pathExists(output)) await fs.unlink(output);
      console.error("[IG ERROR]", e.response?.data || e.message);
      await react("❌");

      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message || "Error desconocido";

      // Error amigable para errores comunes
      if (errorMsg.includes("502") || errorMsg.includes("Bad gateway")) {
        return reply(sock, jid, "🔧 El servicio está temporalmente caído.\n\n> _Intenta de nuevo en unos minutos_ 🌸", msg);
      }
      if (errorMsg.includes("private") || errorMsg.includes("privado")) {
        return reply(sock, jid, "❌ Ese perfil o publicación es *privado*.", msg);
      }

      await reply(sock, jid, `❌ ${errorMsg}`, msg);
    }
  },
};