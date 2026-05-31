import fs from "fs";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { TEMP_DIR } from "../../config.js";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;

function safeFileName(name) {
  return String(name || "audio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "audio";
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
}

function extractAppleMusicUrl(text) {
  const m = String(text || "").match(/https?:\/\/music\.apple\.com\/[^\s]+/i);
  return m ? m[0].trim() : "";
}

async function readStreamToText(stream) {
  return new Promise((res, rej) => {
    let d = "";
    stream.on("data", (c) => (d += c.toString()));
    stream.on("end", () => res(d));
    stream.on("error", rej);
  });
}

export default {
  name: "applemusic",
  aliases: ["amusic", "apple", "am"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const input = args.join(" ").trim();

    if (!input) {
      return reply(sock, jid,
        "❌ *Uso:*\n.applemusic <link de Apple Music>\n\n💡 Ejemplo:\n.applemusic https://music.apple.com/...",
        msg
      );
    }

    const url = extractAppleMusicUrl(input);
    if (!url) {
      return reply(sock, jid, "❌ No encontré un link de Apple Music válido.", msg);
    }

    await reply(sock, jid, "🍎 *Descargando desde Apple Music...*", msg);

    const outputPath = path.join(TEMP_DIR, `am_${Date.now()}.mp3`);

    try {
      // 1. Obtener link de descarga
      const { data } = await axios.get(`${API_BASE}/applemusicdl`, {
        params: { mode: "link", url, apikey: APIKEY },
        timeout: 30000,
        validateStatus: () => true,
      });

      console.log("[APPLE MUSIC] Respuesta API:", JSON.stringify(data).slice(0, 300));

      if (!data?.ok) throw new Error(data?.detail || data?.message || "La API no devolvió resultado exitoso.");

      const dlUrl = data?.download_url_full || data?.stream_url_full || data?.download_url || data?.url;
      if (!dlUrl) throw new Error("No se encontró el link de descarga.");

      const title     = safeFileName(data?.title || "Apple Music Audio");
      const artist    = data?.artist || data?.author || "";
      const thumbnail = data?.thumbnail || data?.cover || null;
      const duration  = data?.duration || "";

      // 2. Mostrar info con thumbnail si hay
      if (thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: thumbnail },
          caption:
            `🍎 *${title}*\n` +
            (artist   ? `🎤 *Artista:* ${artist}\n`   : "") +
            (duration ? `⏱️ *Duración:* ${duration}\n` : "") +
            `\n⬇️ Descargando...`,
        }, quoted);
      }

      // 3. Descargar audio
      const response = await axios.get(dlUrl, {
        responseType: "stream",
        timeout: 120000,
        validateStatus: () => true,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        maxRedirects: 10,
      });

      if (response.status >= 400) {
        const err = await readStreamToText(response.data).catch(() => "");
        throw new Error(err || "Error al descargar el audio.");
      }

      await pipeline(response.data, fs.createWriteStream(outputPath));

      const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
      if (!size || size < 50000) throw new Error("Archivo descargado inválido o muy pequeño.");

      // 4. Enviar audio
      try {
        await sock.sendMessage(jid, {
          audio: { url: outputPath },
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${title}.mp3`,
        }, quoted);
      } catch {
        await sock.sendMessage(jid, {
          document: { url: outputPath },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          caption: `🍎 ${title}${artist ? ` — ${artist}` : ""}`,
        }, quoted);
      }

      console.log("✅ Apple Music enviado:", title);

    } catch (e) {
      console.error("[APPLE MUSIC ERROR]", e.message);
      await reply(sock, jid, `❌ No se pudo descargar.\n\n🔎 *Razón:* ${e.message}`, msg);
    } finally {
      deleteFileSafe(outputPath);
    }
  },
};