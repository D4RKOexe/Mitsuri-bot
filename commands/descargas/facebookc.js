import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

const COOKIES_PATH = path.resolve("cookies/fb_cookies.json");

// ─── Extraer URL de Facebook ───────────────────────────────────────────────────
function extractFbUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.|m\.|web\.|l\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i
  );
  if (!match) return null;
  // Limpiar params de tracking
  try {
    const u = new URL(match[0]);
    ["mibextid", "locale", "ref", "refid", "__tn__"].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return match[0];
  }
}

// ─── Ejecutar yt-dlp ──────────────────────────────────────────────────────────
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", err => {
      if (err?.code === "ENOENT") reject(new Error("yt-dlp no está instalado."));
      else reject(err);
    });
    child.on("close", code => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.trim() || `yt-dlp terminó con código ${code}`));
    });
  });
}

// ─── Convertir a formato WhatsApp con ffmpeg ──────────────────────────────────
function convertToWhatsapp(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-y", "-i", input,
      "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-vf", "scale='min(1280,iw)':-2",
      "-c:a", "aac", "-b:a", "128k",
      output,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-300) || `ffmpeg código ${code}`));
    });
  });
}

export default {
  name: "fbc",
  aliases: ["facebookc", "fbmp4c", "fbc", "fbcookiec"],
  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
    };

    const url = extractFbUrl(args.join(" "));

    if (!url) {
      await react("❌");
      return reply(sock, jid,
        "❌ Envía un link válido de Facebook.\n" +
        "Ej: `.fb https://www.facebook.com/reel/ID`",
        msg
      );
    }

    // Verificar cookies
    if (!fs.existsSync(COOKIES_PATH)) {
      await react("❌");
      return reply(sock, jid,
        "❌ No se encontraron las cookies de Facebook.\n" +
        "Guarda el archivo en: `cookies/fb_cookies.json`",
        msg
      );
    }

    await react("⏳");
    await reply(sock, jid, "⬇️ *Descargando Facebook...*", msg);

    const base     = `fb_${Date.now()}`;
    const rawPath  = path.join(TEMP_DIR, `${base}_raw.mp4`);
    const finalPath = path.join(TEMP_DIR, `${base}_wa.mp4`);

    try {
      // ── Descargar con yt-dlp + cookies JSON ──────────────────────────────
      await runYtDlp([
        "--cookies", COOKIES_PATH,        // cookies exportadas del navegador
        "-f", "bv*+ba/b",                 // mejor video + audio, fallback a cualquiera
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", rawPath,
        url,
      ]);

      if (!fs.existsSync(rawPath)) throw new Error("No se descargó el video.");

      const rawSize = fs.statSync(rawPath).size;
      if (rawSize < 50_000) throw new Error("El video descargado está vacío o es inválido.");

      // ── Convertir para WhatsApp ───────────────────────────────────────────
      await reply(sock, jid, "🛠️ *Procesando video...*", msg);
      await convertToWhatsapp(rawPath, finalPath);

      if (!fs.existsSync(finalPath)) throw new Error("Error al convertir el video.");

      const stat    = fs.statSync(finalPath);
      if (stat.size < 50_000) throw new Error("El video convertido está vacío.");

      const sizeMB  = (stat.size / (1024 * 1024)).toFixed(1);
      const isLarge = stat.size > 99 * 1024 * 1024;
      const caption = `✅ *Facebook listo!*\n📦 ${sizeMB}MB`;

      // ── Enviar ────────────────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          [isLarge ? "document" : "video"]: { url: finalPath },
          mimetype: "video/mp4",
          fileName: `facebook_${Date.now()}.mp4`,
          caption,
        }, { quoted: msg });
      } catch {
        // Fallback a documento si falla como video
        await sock.sendMessage(jid, {
          document: { url: finalPath },
          mimetype: "video/mp4",
          fileName: `facebook_${Date.now()}.mp4`,
          caption,
        }, { quoted: msg });
      }

      await react("✅");

    } catch (e) {
      console.error("[FB ERROR]", e.message);
      await react("❌");

      // Mensaje de error más legible
      let userMsg = `❌ ${e.message}`;
      if (e.message.includes("Private")) userMsg = "❌ El video es privado o requiere una cuenta con acceso.";
      else if (e.message.includes("login")) userMsg = "❌ Facebook requiere login para este video. Actualiza las cookies.";
      else if (e.message.includes("yt-dlp")) userMsg = "❌ yt-dlp no está instalado. Ejecuta: `pip install yt-dlp`";

      await reply(sock, jid, userMsg, msg);

    } finally {
      // Limpiar archivos temporales
      for (const f of [rawPath, finalPath]) {
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
      }
    }
  },
};