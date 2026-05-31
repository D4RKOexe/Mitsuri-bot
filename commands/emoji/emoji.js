import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;

async function toWebpSticker(inputBuffer, ext = "png") {
  const id      = randomUUID();
  const inPath  = join(tmpdir(), `emojimix_in_${id}.${ext}`);
  const outPath = join(tmpdir(), `emojimix_out_${id}.webp`);

  await writeFile(inPath, inputBuffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .outputOptions([
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-vcodec", "libwebp",
        "-lossless", "0",
        "-qscale", "75",
        "-preset", "default",
        "-loop", "0",
        "-an",
        "-vsync", "0",
      ])
      .toFormat("webp")
      .save(outPath)
      .on("end", resolve)
      .on("error", reject);
  });

  const outBuffer = await import("fs").then(fs => fs.promises.readFile(outPath));

  // Limpieza de temporales
  await unlink(inPath).catch(() => {});
  await unlink(outPath).catch(() => {});

  return outBuffer;
}

export default {
  name: "emojimix",
  aliases: ["emojicombine", "mixemoji"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    const fullText  = args.join("");
    const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
    const foundEmojis = fullText.match(emojiRegex);

    if (!foundEmojis || foundEmojis.length < 2) {
      return reply(sock, jid,
        "❌ Debes enviar dos emojis para mezclarlos.\n📌 Ejemplo: *.emojimix 🐱🔥*",
        msg
      );
    }

    const emoji1 = foundEmojis[0];
    const emoji2 = foundEmojis[1];

    await reply(sock, jid, `⏳ *Mezclando emojis:* ${emoji1} + ${emoji2}...`, msg);

    try {
      const { data } = await axios.get(`${API_BASE}/search/tenor/emoji`, {
        params: { emoji1, emoji2, apikey: APIKEY },
        headers: { "x-api-key": APIKEY },
        timeout: 20000,
      });

      let imageUrl = data?.url_full || data?.url;
      if (!imageUrl) throw new Error("La API no devolvió una imagen.");
      if (imageUrl.startsWith("/")) imageUrl = `${API_BASE}${imageUrl}`;

      // Detectar extensión desde la URL
      const ext = "png";

      // Descargar imagen como buffer
      const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
      const imgBuffer = Buffer.from(imgRes.data);

      // Convertir a WebP con ffmpeg
      const webpBuffer = await toWebpSticker(imgBuffer, ext);

      await sock.sendMessage(jid, {
        sticker: webpBuffer,
        stickerAuthor: "ByteBot",
        stickerName: `${emoji1}+${emoji2}`,
      }, { quoted: msg });

    } catch (e) {
      console.error("[EMOJIMIX ERROR]", e.message);
      await reply(sock, jid,
        "❌ No se pudo mezclar. Intenta con otros emojis compatibles.",
        msg
      );
    }
  },
};