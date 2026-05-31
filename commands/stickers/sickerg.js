import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export default {
  name: "sg",
  aliases: ["stickerfull", "stickercrop", "sc"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = quoted?.imageMessage || msg.message?.imageMessage;
    const isVideo = quoted?.videoMessage || msg.message?.videoMessage;

    if (!isImage && !isVideo) {
      return reply(
        sock,
        jid,
        "❌ Responde a una imagen o video corto con *.sg* para crear un sticker que llene todo el cuadro.",
        msg
      );
    }

    try {
      await reply(sock, jid, "⏳ Creando sticker ajustado al cuadro...", msg);

      const mediaMsg =
        msg.message?.imageMessage || msg.message?.videoMessage
          ? msg
          : { message: quoted, key: msg.key };

      const buffer = await downloadMediaMessage(mediaMsg, "buffer", {});

      const sticker = new Sticker(buffer, {
        pack: "𝒱𝒶𝓁ℯ𝓃𝓉𝒾𝓃𝒶 ℬℴ𝓉❤️",
        author: "Draven 🏴‍☠️",
        type: StickerTypes.CROPPED,
        quality: 70,
        categories: ["🤩", "🎉"],
      });

      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(
        jid,
        { sticker: stickerBuffer },
        { quoted: msg }
      );
    } catch (e) {
      console.error("Error en sticker ajustado:", e);
      await reply(sock, jid, "❌ Hubo un error al procesar el sticker.", msg);
    }
  },
};