// comandos/descargas/ytmp3c.js
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

function extractYouTubeUrl(text) {
  const m = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i
  );
  return m ? m[0].trim() : "";
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
  name: "ytmp3c",
  aliases: ["playc"],
  run: async (sock, msg, args, jid) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;

    if (!args.length) {
      return reply(
        sock,
        jid,
        "❌ Uso:\n.ytmp3c <link de YouTube>",
        msg
      );
    }

    const rawText = args.join(" ").trim();
    const url = extractYouTubeUrl(rawText);

    if (!url) {
      return reply(
        sock,
        jid,
        "❌ Envía un link válido de YouTube.\nEj: .ytmp3c https://youtu.be/...",
        msg
      );
    }

    await reply(
      sock,
      jid,
      "🎵 Descargando audio con yt-dlp...",
      msg
    );

    const base = `ytc_${Date.now()}`;
    const outPath = path.join(TEMP_DIR, `${base}.mp3`);

    try {
      const argsYt = [
        "-f",
        "bestaudio",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "5", // ~128kbps
        "-o",
        outPath,
        url,
      ];

      await runCommand("yt-dlp", argsYt);

      if (!fs.existsSync(outPath)) {
        throw new Error("No se pudo guardar el MP3 descargado.");
      }

      const size = fs.statSync(outPath).size;
      if (!size || size < 50000) {
        throw new Error("El archivo descargado es inválido o está vacío.");
      }

      await sock.sendMessage(
        jid,
        {
          audio: { url: outPath },
          mimetype: "audio/mpeg",
          ptt: false,
        },
        quoted
      );
    } catch (error) {
      console.error("[ytmp3c yt-dlp] Error:", error.message);
      await reply(
        sock,
        jid,
        `❌ Error usando yt-dlp: ${error.message}`,
        msg
      );
    } finally {
      if (fs.existsSync(outPath)) {
        try {
          fs.unlinkSync(outPath);
        } catch {}
      }
    }
  },
};
