import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

const TEMP_DIR = "./temp_apk";
const APIURL = `${process.env.DV_API_URL}/apkmod`;
const APIKEY = process.env.DV_API_KEY;

function safeFileName(name) {
  return String(name || "apk_file")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchMod(query) {
  const { data } = await axios.get(APIURL, {
    params: { mode: "link", q: query, pick: 1, apikey: APIKEY },
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  return data;
}

export default {
  name: "apkmod",
  aliases: ["mod", "modapk", "hackapp"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    try {
      const input = args.join(" ").trim();

      if (!input) {
        return reply(sock, jid,
          `╭━━━〔 🔧 APK MOD 〕━━━⬣\n` +
          `┃ ❌ Debes escribir una app.\n┃\n` +
          `┃ 📌 Ejemplos:\n` +
          `┃ .mod free fire\n` +
          `┃ .mod minecraft\n` +
          `┃ .mod among us\n` +
          `╰━━━━━━━━━━━━━━━━⬣`,
          msg
        );
      }

      // Reacción de inicio
      try { await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }); } catch {}

      await reply(sock, jid,
        `╭━━━〔 🔧 APK MOD 〕━━━⬣\n` +
        `┃ 🔎 Buscando: ${input}\n` +
        `┃ ⏳ Espera un momento...\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
        msg
      );

      const data = await searchMod(input);

      if (!data?.ok || !data?.title) {
        try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
        return reply(sock, jid,
          `╭━━━〔 ❌ SIN RESULTADOS 〕━━━⬣\n` +
          `┃ No encontré mods para:\n` +
          `┃ "${input}"\n┃\n` +
          `┃ Intenta con otro nombre.\n` +
          `╰━━━━━━━━━━━━━━━━⬣`,
          msg
        );
      }

      const appName  = data.title    || input;
      const version  = data.version  || "";
      const size     = data.filesize || "";
      const provider = data.provider || data.source || "Desconocido";
      const icon     = data.icon     || null;

      const directUrl =
        data.download_url_full || data.stream_url_full ||
        data.download_url      || data.stream_url      ||
        data.url;

      if (!directUrl) throw new Error("La API no devolvió link de descarga.");

      // Mensaje con info básica
      const infoMsg =
        `╭━━━〔 🔧 APK MOD ENCONTRADO 〕━━━⬣\n` +
        `┃ 📦 *${appName}*\n` +
        (version ? `┃ 🏷️ Versión: ${version}\n` : "") +
        (size    ? `┃ 💾 Tamaño: ${size}\n`      : "") +
        `┃ 🌐 Fuente: ${provider}\n` +
        `┃ ⬇️ Descargando...\n` +
        `╰━━━━━━━━━━━━━━━━⬣`;

      if (icon) {
        try {
          await sock.sendMessage(jid, { image: { url: icon }, caption: infoMsg }, { quoted: msg });
        } catch {
          await reply(sock, jid, infoMsg, msg);
        }
      } else {
        await reply(sock, jid, infoMsg, msg);
      }

      // Descargar a archivo temporal
      const fileName = safeFileName(`${appName}_${version || Date.now()}.apk`);
      const filePath = path.join(TEMP_DIR, fileName);
      await fs.ensureDir(TEMP_DIR);

      const response = await axios.get(directUrl, {
        responseType: "stream",
        timeout: 300000,
        maxRedirects: 10,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "*/*",
          "x-api-key": APIKEY,
        },
        params: { apikey: APIKEY },
      });
      await pipeline(response.data, fs.createWriteStream(filePath));

      const stats = await fs.stat(filePath);
      if (!stats.size || stats.size < 50000) throw new Error("Archivo corrupto o incompleto.");

      const fileBuffer = await fs.readFile(filePath);
      await fs.unlink(filePath).catch(() => {});

      // Reacción de éxito
      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      await sock.sendMessage(jid, {
        document: fileBuffer,
        fileName,
        mimetype: "application/vnd.android.package-archive",
        caption:
          `╭━━━〔 ✅ MOD LISTO 〕━━━⬣\n` +
          `┃ 📦 *${appName}*\n` +
          (version ? `┃ 🏷️ ${version}\n` : "") +
          (size    ? `┃ 💾 ${size}\n`     : "") +
          `┃ 🌐 ${provider}\n` +
          `┃ 🚀 Listo para instalar\n` +
          `╰━━━━━━━━━━━━━━━━⬣`,
      }, { quoted: msg });

    } catch (e) {
      console.error("[APKMOD ERROR]", e?.response?.data || e.message);

      // Reacción de error
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}

      const errMsg = e?.response?.data?.detail || e?.response?.data?.message || e.message || "Error desconocido";

      let humanError =
        `╭━━━〔 ❌ ERROR 〕━━━⬣\n` +
        `┃ No se pudo obtener el mod.\n┃\n` +
        `┃ 🔎 ${errMsg}\n` +
        `╰━━━━━━━━━━━━━━━━⬣`;

      if (errMsg.includes("502") || errMsg.includes("Bad Gateway")) {
        humanError =
          `╭━━━〔 ⚠️ SERVIDOR OCUPADO 〕━━━⬣\n` +
          `┃ La API está saturada o caída.\n┃\n` +
          `┃ 🔁 Intenta en unos minutos.\n` +
          `╰━━━━━━━━━━━━━━━━⬣`;
      }

      await reply(sock, jid, humanError, msg);

    } finally {
      try { await fs.emptyDir(TEMP_DIR); } catch {}
    }
  },
};