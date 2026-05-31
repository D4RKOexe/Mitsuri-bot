// comandos/descargas/fbc.js
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

function extractFbUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i
  );
  return match ? match[0].trim() : "";
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";

    child.stdout.on("data", () => {});
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

async function convertToWhatsapp(inputPath, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-c:v", "libx264",
    "-profile:v", "baseline",
    "-level", "3.0",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-vf", "scale='min(1280,iw)':-2",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath
  ]);
}

export default {
  name: "fbc",
  aliases: ["fbtemp", "fbcookie"],
  run: async (sock, msg, args, jid) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;

    if (!args.length) {
      return reply(
        sock,
        jid,
        "❌ Uso:\n.fbc <link de Facebook>\n\nComando temporal: usa yt-dlp + cookies de Firefox.",
        msg
      );
    }

    const rawText = args.join(" ").trim();
    const url = extractFbUrl(rawText);

    if (!url) {
      return reply(
        sock,
        jid,
        "❌ Envía un link válido de Facebook.\nEj: .fbc https://fb.watch/...",
        msg
      );
    }

    await reply(
      sock,
      jid,
      "⬇️ Descargando Facebook con yt-dlp (cookies de Firefox)...",
      msg
    );

    const baseName = `fb_${Date.now()}`;
    const rawPath = path.join(TEMP_DIR, `${baseName}_raw.mp4`);
    const finalPath = path.join(TEMP_DIR, `${baseName}_wa.mp4`);

    try {
      const argsYt = [
        "--cookies-from-browser",
        "firefox",
        "-f",
        "bv*+ba/b",
        "--merge-output-format",
        "mp4",
        "-o",
        rawPath,
        url
      ];

      await runCommand("yt-dlp", argsYt);

      if (!fs.existsSync(rawPath)) {
        throw new Error("No se pudo guardar el video descargado.");
      }

      const rawSize = fs.statSync(rawPath).size;
      if (!rawSize || rawSize < 150000) {
        throw new Error("El archivo descargado es inválido o está vacío.");
      }

      await reply(
        sock,
        jid,
        "🛠️ Convirtiendo a formato compatible con WhatsApp...",
        msg
      );

      await convertToWhatsapp(rawPath, finalPath);

      if (!fs.existsSync(finalPath)) {
        throw new Error("No se pudo convertir el video a formato compatible.");
      }

      const size = fs.statSync(finalPath).size;
      if (!size || size < 150000) {
        throw new Error("El archivo convertido es inválido o está vacío.");
      }

      const caption = `📱 Facebook (cookies)\n🎬 Convertido para WhatsApp`;

      await sock.sendMessage(
        jid,
        {
          video: { url: finalPath },
          mimetype: "video/mp4",
          caption,
        },
        quoted
      );
    } catch (error) {
      console.error("[Facebook yt-dlp] Error:", error.message);
      await reply(
        sock,
        jid,
        `❌ Error usando yt-dlp para Facebook: ${error.message}`,
        msg
      );
    } finally {
      for (const file of [rawPath, finalPath]) {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch {}
        }
      }
    }
  },
};