import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

// ─── Cobalt API (gratis, sin key) ─────────────────────────────────────────────
const COBALT = "https://api.cobalt.tools";

const RE_URL = /https?:\/\/(?:www\.|m\.|web\.|l\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i;

function cleanFbUrl(raw) {
  const match = String(raw || "").match(RE_URL);
  if (!match) return null;
  try {
    const u = new URL(match[0]);
    // Quitar tracking params que confunden a cobalt
    ["mibextid", "locale", "ref", "refid", "__tn__"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return match[0];
  }
}

async function cobaltFetch(fbUrl) {
  const { data } = await axios.post(
    COBALT,
    { url: fbUrl, videoQuality: "1080", filenameStyle: "basic" },
    {
      timeout: 30_000,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  return data;
}

export default {
  name: "fb",
  aliases: ["facebook", "fbmp4"],
  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
    };

    const fbUrl = cleanFbUrl(args.join(" "));

    if (!fbUrl) {
      await react("❌");
      return reply(sock, jid, "❌ Envía un link válido de Facebook.\nEj: `.fb https://www.facebook.com/reel/ID`", msg);
    }

    await react("⏳");
    await reply(sock, jid, "⬇️ *Descargando Facebook...*", msg);
    await fs.ensureDir(TEMP_DIR);

    const output = path.join(TEMP_DIR, `fb_${Date.now()}.mp4`);

    try {
      // ── Cobalt ──────────────────────────────────────────────────────────
      const data = await cobaltFetch(fbUrl);

      console.log("[FB] Cobalt status:", data?.status, "| url:", String(data?.url || "").slice(0, 80));

      // status puede ser: "stream", "redirect", "picker", "error", "rate-limit"
      if (data?.status === "error" || data?.status === "rate-limit") {
        const msg_err = data?.error?.code || data?.text || "La API no pudo procesar el link.";
        throw new Error(msg_err);
      }

      let videoUrl = null;

      if (data?.status === "stream" || data?.status === "redirect") {
        videoUrl = data.url;
      } else if (data?.status === "picker") {
        // Cobalt devuelve lista — tomar el primer video
        const item = data.picker?.find(p => p.type === "video") || data.picker?.[0];
        videoUrl = item?.url;
      }

      if (!videoUrl) throw new Error("No se encontró el video. Puede ser privado o requerir login.");

      // ── Descargar video ─────────────────────────────────────────────────
      const response = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 120_000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      await pipeline(response.data, fs.createWriteStream(output));

      const stat = await fs.stat(output);
      if (!stat.size || stat.size < 50_000) throw new Error("Video corrupto o vacío.");

      const sizeMB  = (stat.size / (1024 * 1024)).toFixed(1);
      const isLarge = stat.size > 99 * 1024 * 1024;
      const caption = `✅ *Facebook listo!*\n📦 ${sizeMB}MB`;

      // ── Enviar ──────────────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          [isLarge ? "document" : "video"]: { url: output },
          mimetype: "video/mp4",
          fileName: `facebook_${Date.now()}.mp4`,
          caption,
        }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, {
          document: { url: output },
          mimetype: "video/mp4",
          fileName: `facebook_${Date.now()}.mp4`,
          caption,
        }, { quoted: msg });
      }

      await react("✅");
      await fs.unlink(output);

    } catch (e) {
      if (await fs.pathExists(output)) await fs.unlink(output).catch(() => {});
      console.error("[FB ERROR]", e.response?.data || e.message);

      const esRateLimit = e.message?.toLowerCase().includes("rate");
      const userMsg = esRateLimit
        ? "⏳ Demasiadas peticiones, espera un momento e intenta de nuevo."
        : `❌ ${e.message}`;

      await react("❌");
      await reply(sock, jid, userMsg, msg);
    }
  },
};