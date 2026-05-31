// comandos/descargas/ttc.js
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

function extractUrl(text) {
  if (!text) return null;

  const clean = text
    .replace(/^\[|\]$/g, "")
    .replace(/[<>]/g, "")
    .trim();

  const allUrls = clean.match(/https?:\/\/[^\s)>\]]+/gi);
  if (allUrls && allUrls.length) return allUrls[0];

  const markdownUrl = clean.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownUrl?.[1]) return markdownUrl[1];

  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (error?.code === "ENOENT") {
        return reject(
          new Error(`${command} no está instalado o no está en el PATH.`)
        );
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve(stderr);
      reject(new Error(stderr.trim() || `${command} terminó con código ${code}`));
    });
  });
}

export default {
  name: "ttc",
  aliases: ["tiktokc", "ttcookie"],
  run: async (sock, msg, args, jid) => {
    if (!args.length) {
      return reply(
        sock,
        jid,
        "❌ Uso:\n.ttc <link de TikTok>\n\nEste comando usa yt-dlp + cookies de Firefox.",
        msg
      );
    }

    const rawText = args.join(" ").trim();
    const extractedUrl = extractUrl(rawText);

    if (!extractedUrl) {
      return reply(sock, jid, "❌ No pude extraer la URL del mensaje.", msg);
    }

    let parsed;
    try {
      parsed = new URL(extractedUrl);
    } catch {
      return reply(sock, jid, "❌ URL inválida.", msg);
    }

    if (!/(\.|^)tiktok\.com$/i.test(parsed.hostname)) {
      return reply(sock, jid, "❌ Solo links de TikTok.", msg);
    }

    await reply(
      sock,
      jid,
      "⬇️ Descargando TikTok con yt-dlp (cookies de Firefox)...",
      msg
    );

    const baseName = `tt_${Date.now()}`;
    const outputPath = path.join(TEMP_DIR, `${baseName}.mp4`);

    try {
      // yt-dlp con cookies de Firefox
      const argsYt = [
        "--cookies-from-browser",
        "firefox",
        "-f",
        "bv*+ba/b",
        "--merge-output-format",
        "mp4",
        "-o",
        outputPath,
        extractedUrl,
      ];

      await runCommand("yt-dlp", argsYt);

      if (!fs.existsSync(outputPath)) {
        throw new Error("No se pudo guardar el video descargado.");
      }

      const stats = fs.statSync(outputPath);
      if (stats.size < 50000) {
        throw new Error("El archivo descargado está vacío o corrupto.");
      }

      const caption = `🎵 TikTok (cookies)\n📹 Descargado con yt-dlp`;

      await sock.sendMessage(
        jid,
        {
          video: { url: outputPath },
          caption,
          mimetype: "video/mp4",
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error("[TikTok yt-dlp] Error:", error.message);
      await reply(
        sock,
        jid,
        `❌ Error usando yt-dlp: ${error.message}`,
        msg
      );
    } finally {
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch {}
      }
    }
  },
};