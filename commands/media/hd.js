import axios from "axios";
import { reply } from "../../utils.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const APIURL = `${process.env.DV_API_URL}/image/hd`;
const APIKEY = process.env.DV_API_KEY;
const IMGBB  = `${process.env.DV_API_URL}/imgbb`;

export default {
  name: "hd",
  aliases: ["imagehd", "mejorar", "upscale"],
  description: "Mejora la calidad de una imagen a HD",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    // ── Detectar imagen — directa o respondida ─────────────────
    const quoted   = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg   =
      msg.message?.imageMessage ||
      msg.message?.stickerMessage ||
      quoted?.imageMessage ||
      quoted?.stickerMessage ||
      null;

    if (!imgMsg) {
      await react("❌");
      return reply(sock, jid,
        "❌ Envía o responde una imagen con el comando.\n\n📌 Ej: `.hd` _(respondiendo una foto)_",
        msg
      );
    }

    await react("⏳");
    await reply(sock, jid, "🔍 *Subiendo imagen...*", msg);

    try {
      // ── 1. Descargar imagen como buffer ───────────────────────
      const msgToDownload = quoted
        ? { message: quoted, key: { ...msg.key, id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId } }
        : msg;

      const buffer = await downloadMediaMessage(msgToDownload, "buffer", {});
      if (!buffer || buffer.length < 100) throw new Error("No pude descargar la imagen.");

      // ── 2. Subir a ImgBB para obtener URL pública ─────────────
      const base64 = buffer.toString("base64");

      const { data: imgbbData } = await axios.post(`${IMGBB}?apikey=${APIKEY}`, {
        image: base64
      }, {
        timeout: 30000,
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" }
      });

      console.log("[HD] ImgBB:", JSON.stringify(imgbbData).slice(0, 200));

      const imageUrl =
        imgbbData?.url ||
        imgbbData?.data?.url ||
        imgbbData?.display_url ||
        imgbbData?.data?.display_url ||
        null;

      if (!imageUrl) throw new Error("No pude subir la imagen.");

      await reply(sock, jid, "✨ *Mejorando calidad...*", msg);

      // ── 3. Llamar API HD con la URL pública ───────────────────
      const { data } = await axios.get(APIURL, {
        params: {
          url:    imageUrl,
          scale:  2,
          format: "auto",
          apikey: APIKEY
        },
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }
      });

      console.log("[HD] Respuesta:", JSON.stringify(data).slice(0, 300));

      if (!data?.ok) throw new Error(data?.detail || "La API no respondió correctamente.");

      const resultUrl =
        data.download_url_full ||
        data.stream_url_full ||
        data.download_url ||
        data.url;

      if (!resultUrl) throw new Error("No encontré la imagen mejorada.");

      // ── 4. Enviar resultado ───────────────────────────────────
      await sock.sendMessage(jid, {
        image: { url: resultUrl },
        caption:
          `✅ *Imagen mejorada en HD* 🌸\n\n` +
          `📐 *Original:* ${data.original_width}×${data.original_height}\n` +
          `📐 *Nueva:* ${data.width}×${data.height}\n` +
          `📦 *Tamaño:* ${((data.size_bytes || 0) / 1024).toFixed(0)} KB`,
      }, { quoted: msg });

      await react("✅");

    } catch (e) {
      console.error("[HD ERROR]", e.response?.data || e.message);
      await react("❌");
      return reply(sock, jid, `❌ ${e.response?.data?.detail || e.message}`, msg);
    }
  },
};