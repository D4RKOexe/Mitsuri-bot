import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import fs from "fs-extra";
import path from "path";
import { TEMP_DIR } from "../../config.js";

export default {
  name: "s",
  aliases: ["sticker", "stiker"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    
    // Capturamos el mensaje citado (quoted) o el mensaje directo
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = quoted?.imageMessage || msg.message?.imageMessage;
    const isVideo = quoted?.videoMessage || msg.message?.videoMessage;

    if (!isImage && !isVideo) {
      return reply(sock, jid, "❌ Responde a una imagen o video corto con *.s* para crear un sticker.", msg);
    }

    try {
      await reply(sock, jid, "⏳ Creando sticker...", msg);

      // Determinamos cuál mensaje contiene el archivo multimedia
      const mediaMsg = (msg.message?.imageMessage || msg.message?.videoMessage) ? msg : { message: quoted, key: msg.key };
      
      // Descargamos el contenido a un buffer
      const buffer = await downloadMediaMessage(mediaMsg, "buffer", {});

      // Configuramos el sticker con metadatos (Nombre y Autor)
      const sticker = new Sticker(buffer, {
        pack: "𝒱𝒶𝓁ℯ𝓃𝓉𝒾𝓃𝒶 ℬℴ𝓉❤️",      // Nombre del paquete de stickers
        author: "Draven 🏴‍☠️",           // Nombre del creador/autor
        type: StickerTypes.FULL,       // Mantiene la imagen completa sin estirar
        quality: 70,                   // Calidad del sticker (0-100)
        categories: ["🤩", "🎉"],     // Emojis asociados
      });

      // Convertimos a buffer de webp con metadatos inyectados
      const stickerBuffer = await sticker.toBuffer();

      // Enviamos el sticker directamente
      await sock.sendMessage(jid, { 
        sticker: stickerBuffer 
      }, { quoted: msg });

    } catch (e) {
      console.error("Error en Sticker:", e);
      await reply(sock, jid, "❌ Hubo un error al procesar el sticker.", msg);
    }
  }
};
