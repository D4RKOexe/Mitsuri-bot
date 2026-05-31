import fs from "fs";
import path from "path";
import {
  downloadMediaMessage,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";
import { TEMP_DIR } from "../../config.js";

function getQuotedInfo(msg) {
  const ctx = msg?.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage || !ctx?.stanzaId || !ctx?.participant) return null;

  return {
    quotedMessage: ctx.quotedMessage,
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant,
    },
  };
}

function findMedia(message) {
  if (!message) return null;
  if (message.imageMessage) return { type: "image", message };
  if (message.videoMessage) return { type: "video", message };
  return null;
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

export default {
  name: "vv",
  aliases: ["ver", "viewonce", "revelar"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const quotedInfo = getQuotedInfo(msg);

    if (!quotedInfo) {
      return reply(sock, jid, "❌ Responde a una foto o video de *ver una sola vez* con *.vv*", msg);
    }

    const normalized = normalizeMessageContent(quotedInfo.quotedMessage);
    const media = findMedia(normalized);

    if (!media) {
      return reply(sock, jid, "❌ No detecté imagen o video válido en el mensaje respondido. Intenta respondiendo directamente al archivo de una sola vez.", msg);
    }

    let tempFile = null;

    try {
      await reply(sock, jid, "👀 Recuperando archivo de ver una sola vez...", msg);

      const fakeMsg = {
        key: quotedInfo.key,
        message: normalized,
      };

      const buffer = await downloadMediaMessage(
        fakeMsg,
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage,
        }
      );

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) {
        throw new Error("No pude descargar el archivo multimedia.");
      }

      if (media.type === "image") {
        await sock.sendMessage(
          jid,
          {
            image: buffer,
            caption: "✅ Imagen recuperada de ver una sola vez",
          },
          { quoted: msg }
        );
        return;
      }

      tempFile = path.join(TEMP_DIR, `vv_${Date.now()}.mp4`);
      fs.writeFileSync(tempFile, buffer);

      try {
        await sock.sendMessage(
          jid,
          {
            video: { url: tempFile },
            mimetype: "video/mp4",
            caption: "✅ Video recuperado de ver una sola vez",
          },
          { quoted: msg }
        );
      } catch {
        await sock.sendMessage(
          jid,
          {
            document: { url: tempFile },
            mimetype: "video/mp4",
            fileName: `viewonce_${Date.now()}.mp4`,
            caption: "✅ Video recuperado de ver una sola vez",
          },
          { quoted: msg }
        );
      }
    } catch (error) {
      await reply(sock, jid, `❌ ${error?.message || "No pude recuperar el archivo de ver una sola vez."}`, msg);
    } finally {
      deleteFileSafe(tempFile);
    }
  }
};
