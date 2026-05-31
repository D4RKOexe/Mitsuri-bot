import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker } from "wa-sticker-formatter";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { TEMP_DIR } from "../../config.js";

const execAsync = promisify(exec);

export default {
  name: "sa",
  aliases: ["sanim", "stickera", "stickeranimado"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const videoMsg = quoted?.videoMessage || msg.message?.videoMessage;

    if (!videoMsg) {
      return reply(sock, jid, "❌ Responde a un video con *.sa*.", msg);
    }

    try {
      await reply(sock, jid, "⏳ Creando sticker animado...", msg);

      const mediaMsg =
        msg.message?.videoMessage ? msg : { message: quoted, key: msg.key };

      const buffer = await downloadMediaMessage(
        mediaMsg,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      await fs.ensureDir(TEMP_DIR);

      const base = Date.now();
      const inputPath = path.join(TEMP_DIR, `anim_${base}.mp4`);
      const outputPath = path.join(TEMP_DIR, `anim_${base}.webp`);

      await fs.writeFile(inputPath, buffer);

      const maxSeconds = 6;

      const cmd = `ffmpeg -y -i "${inputPath}" -ss 0 -t ${maxSeconds} -an -vcodec libwebp -loop 0 -vsync 0 -vf "fps=8,scale=420:420:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -qscale 75 -preset picture "${outputPath}"`;

      await execAsync(cmd);

      const webpBuffer = await fs.readFile(outputPath);

      const sticker = new Sticker(webpBuffer, {
        pack: "𝒱𝒶𝓁ℯ𝓃𝓉𝒾𝓃𝒶 ℬℴ𝓉❤️",
        author: "Draven 🏴‍☠️",
        quality: 40
      });

      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });

      await fs.remove(inputPath);
      await fs.remove(outputPath);
    } catch (e) {
      console.error("Error en .sa:", e);
      await reply(sock, jid, `❌ Error en .sa: ${e.message}`, msg);
    }
  }
};