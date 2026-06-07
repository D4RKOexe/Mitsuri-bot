import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/facebook`;
const APIKEY = process.env.DV_API_KEY;

// ─── Extraer y limpiar URL de Facebook ────────────────────────────────────────
function extractFbUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i
  );
  if (!match) return null;

  try {
    const url = new URL(match[0].trim());
    // Quitar parámetros que rompen algunas APIs (?mibextid, ?locale, etc.)
    url.search = "";
    return url.toString();
  } catch {
    return match[0].trim();
  }
}

// ─── Llamada a la API con reintentos ──────────────────────────────────────────
async function fetchFromApi(fbUrl, retries = 2, delay = 5000) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      const { data } = await axios.get(APIURL, {
        params: { url: fbUrl, quality: "auto", apikey: APIKEY },
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (data?.ok) return data;
      lastError = new Error(data?.detail || "La API no respondió correctamente.");
    } catch (e) {
      const status = e.response?.status;
      lastError = e.response?.data
        ? Object.assign(new Error(e.response.data?.detail || "Error de API"), { data: e.response.data })
        : e;

      // 502/503 → reintentar; otros errores → salir ya
      if (status && ![502, 503].includes(status)) break;
    }

    if (i < retries) {
      console.log(`[FB] Reintento ${i + 1}/${retries} en ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export default {
  name: "fb",
  aliases: ["facebook", "fbmp4"],
  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
      } catch {}
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
      // ── Consultar API (con reintentos automáticos) ──────────────────────
      let data;
      try {
        data = await fetchFromApi(fbUrl);
      } catch (e) {
        // Si falló con URL limpia, intentar una vez más con la URL original (sin limpiar)
        const rawUrl = String(args.join(" ")).match(
          /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i
        )?.[0];

        if (rawUrl && rawUrl !== fbUrl) {
          console.log("[FB] Reintentando con URL original sin limpiar...");
          data = await fetchFromApi(rawUrl, 1, 3000);
        } else {
          throw e;
        }
      }

      console.log("[FB] Respuesta:", JSON.stringify(data).slice(0, 200));

      const videoUrl = data.download_url_full || data.stream_url_full || data.download_url;
      if (!videoUrl) throw new Error("No encontré el link del video.");

      // ── Thumbnail ───────────────────────────────────────────────────────
      if (data.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: data.thumbnail },
          caption:
            `🎬 *${data.title || "Facebook Video"}*\n` +
            (data.duration && data.duration !== "Not Available" ? `⏱️ ${data.duration}\n` : "") +
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
      if (!stats.size || stats.size < 100_000) throw new Error("Video corrupto o muy pequeño.");

      const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      // ── Enviar video ────────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          video: { url: output },
          mimetype: "video/mp4",
          caption: `✅ *Facebook listo!*\n📦 ${sizeMB}MB`,
        }, { quoted: msg });
      } catch {
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
      if (await fs.pathExists(output)) await fs.unlink(output).catch(() => {});
      const errData = e?.data;
      console.error("[FB ERROR]", errData || e.message);

      // Mensaje de error legible al usuario
      const esApi502 = errData?.error_code === 502;
      const msgErr = esApi502
        ? "⏳ El servidor de descarga está saturado, intenta en 1 minuto."
        : `❌ ${e.message}`;

      await react("❌");
      await reply(sock, jid, msgErr, msg);
    }
  },
};