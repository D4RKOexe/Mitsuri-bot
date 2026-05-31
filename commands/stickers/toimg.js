import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { TEMP_DIR } from "../../config.js";
import { Sticker } from "wa-sticker-formatter";

console.log("✅ TOIMG CARGADO");

export default {
  name: "toimg",
  aliases: ["img"],

  run: async (sock, msg, args, jid) => {

    console.log("🔥 TOIMG EJECUTANDO");

    const { reply } = await import("../../utils.js");

    try {

      const quoted =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted?.stickerMessage) {
        return reply(
          sock,
          jid,
          "❌ Responde a un sticker con *.toimg*",
          msg
        );
      }

      await reply(
        sock,
        jid,
        "⏳ Convirtiendo sticker...",
        msg
      );

      // crear temp
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      }

      const id = crypto.randomBytes(5).toString("hex");

      const outputPath = path.join(
        TEMP_DIR,
        `${id}.png`
      );

      // descargar sticker
      const mediaMsg = {
        message: quoted,
        key: msg.key
      };

      const buffer = await downloadMediaMessage(
        mediaMsg,
        "buffer",
        {}
      );

      console.log("📥 Sticker descargado");

      // crear sticker object
      const sticker = new Sticker(buffer);

      // guardar como png
      await sticker.toFile(outputPath);

      console.log("✅ PNG creado");

      // enviar imagen
      await sock.sendMessage(
        jid,
        {
          image: fs.readFileSync(outputPath),
          caption: "✨ Sticker convertido correctamente"
        },
        { quoted: msg }
      );

      console.log("✅ Imagen enviada");

      // limpiar
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

    } catch (e) {

      console.error("❌ ERROR TOIMG:", e);

      await reply(
        sock,
        jid,
        "❌ Error al convertir el sticker.",
        msg
      );

    }

  }
};