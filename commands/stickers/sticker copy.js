import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { Jimp } from "jimp"; // Importación correcta para la v1.6.1

export default {
  name: "st",
  aliases: ["stretch", "stickerstretch"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    
    console.log("🚀 Ejecutando .st con Jimp v1.6.1");

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isQuotedImage = quoted?.imageMessage;
      const isDirectImage = msg.message?.imageMessage;

      if (!isDirectImage && !isQuotedImage) {
        return reply(sock, jid, "❌ Responde a una imagen con *.st*.", msg);
      }

      const mediaMsg = isDirectImage ? msg : { message: quoted, key: msg.key };
      const buffer = await downloadMediaMessage(
        mediaMsg,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      // --- NUEVO MÉTODO PARA JIMP v1.6.1 ---
      const image = await Jimp.read(buffer);
      
      // Estiramos a 512x512
      image.resize({ w: 512, h: 512 }); 
      
      // Obtenemos el buffer en PNG
      const stretchedBuffer = await image.getBuffer("image/png");
      // -------------------------------------

      const sticker = new Sticker(stretchedBuffer, {
        pack: "𝒱𝒶𝓁ℯ𝓃𝓉𝒾𝓃𝒶 ℬℴ𝓉❤️",
        author: "Draven 🏴‍☠️",
        type: StickerTypes.FULL,
        quality: 70,
      });

      const stickerBuffer = await sticker.toBuffer();
      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
      console.log("✅ Sticker enviado con éxito");

    } catch (e) {
      console.error("❌ Error en .st:", e);
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  }
};
