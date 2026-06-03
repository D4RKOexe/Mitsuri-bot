// ═══════════════════════════════════════════
//  toaudio.js — Convertir video a audio
// ═══════════════════════════════════════════

import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { TEMP_DIR } from "../../config.js";

const execAsync = promisify(exec);

export default {
  name: "toaudio",
  aliases: ["ado", "3", "extraeraudio"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const videoMsg = quoted?.videoMessage || msg.message?.videoMessage;

    if (!videoMsg) {
      return reply(sock, jid, "❌ Responde a un video con *.toaudio*.", msg);
    }

    try {
      await reply(sock, jid, "⏳ Extrayendo audio del video...", msg);

      const mediaMsg = msg.message?.videoMessage
        ? msg
        : { message: quoted, key: msg.key };

      const buffer = await downloadMediaMessage(
        mediaMsg,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      await fs.ensureDir(TEMP_DIR);

      const base = Date.now();
      const inputPath  = path.join(TEMP_DIR, `video_${base}.mp4`);
      const outputPath = path.join(TEMP_DIR, `audio_${base}.mp3`);

      await fs.writeFile(inputPath, buffer);

      // Extraer audio con ffmpeg — acepta cualquier formato de video
      await execAsync(
        `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`
      );

      const audioBuffer = await fs.readFile(outputPath);
      const stats = await fs.stat(outputPath);

      if (stats.size < 1000) {
        throw new Error("El video no tiene pista de audio o es demasiado corto.");
      }

      // Enviar como audio reproducible (PTT = false → aparece como audio normal)
      await sock.sendMessage(
        jid,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
        },
        { quoted: msg }
      );

      await fs.remove(inputPath);
      await fs.remove(outputPath);

    } catch (e) {
      console.error("Error en .toaudio:", e);
      await reply(sock, jid, `❌ Error al extraer audio: ${e.message}`, msg);
    }
  },
};