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

async function getDownloadData(query, pick = 1) {
  const { data } = await axios.get(APIURL, {
    params: { mode: "link", q: query, pick, apikey: APIKEY },
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  return data;
}

export async function descargarApk(sock, msg, jid, query, prefer = "apk") {
  await fs.ensureDir(TEMP_DIR);

  // Reacción de carga al inicio
  try { await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }); } catch {}

  try {
    const data = await getDownloadData(query);

    if (!data?.ok) throw new Error(data?.detail || data?.message || "La API no respondió.");

    let directUrl =
      data.download_url_full || data.stream_url_full ||
      data.download_url      || data.stream_url      ||
      data.url               || data.link;

    if (!directUrl) throw new Error("La API no devolvió link.");
    if (directUrl.startsWith("/")) directUrl = `${process.env.DV_API_URL}${directUrl}`;

    const appName = data.name    || data.title       || query;
    const version = data.version || data.ver         || "";
    const size    = data.size    || data.filesize     || "";
    const pkg     = data.package || data.packageName || "";

    await sock.sendMessage(jid, {
      text:
        `╭━━━〔 📱 APP ENCONTRADA 〕━━━⬣\n` +
        `┃ 📦 Nombre: ${appName}\n` +
        (version ? `┃ 🏷️ Versión: ${version}\n` : "") +
        (size    ? `┃ 💾 Tamaño: ${size}\n`      : "") +
        (pkg     ? `┃ 📌 Package: ${pkg}\n`       : "") +
        `┃\n┃ ⬇️ Descargando ${prefer.toUpperCase()}...\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
    }, { quoted: msg });

    const ext      = prefer === "xapk" ? ".xapk" : ".apk";
    const fileName = safeFileName(`${appName}_${version || Date.now()}${ext}`);
    const filePath = path.join(TEMP_DIR, fileName);

    // Descargar sin barra de progreso
    const response = await axios.get(directUrl, {
      responseType: "stream",
      timeout: 300000,
      maxRedirects: 10,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "*/*" },
    });
    await pipeline(response.data, fs.createWriteStream(filePath));

    const stats = await fs.stat(filePath);
    if (!stats.size || stats.size < 50000) throw new Error("Archivo corrupto o incompleto.");

    const fileBuffer = await fs.readFile(filePath);
    await fs.unlink(filePath).catch(() => {});

    await sock.sendMessage(jid, {
      document: fileBuffer,
      fileName,
      mimetype: prefer === "xapk"
        ? "application/octet-stream"
        : "application/vnd.android.package-archive",
      caption:
        `╭━━━〔 ✅ APK DESCARGADO 〕━━━⬣\n` +
        `┃ 📦 ${appName}\n` +
        (version ? `┃ 🏷️ ${version}\n` : "") +
        (size    ? `┃ 💾 ${size}\n`     : "") +
        `┃ 🚀 Listo para instalar\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
    }, { quoted: msg });

    // Reacción de éxito
    try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

  } catch (e) {
    console.error("[APKMOD ERROR]", e?.response?.data || e.message);

    // Reacción de error
    try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}

    const errMsg = e?.response?.data?.detail || e?.response?.data?.message || e.message || "Error desconocido";

    let humanError =
      `╭━━━〔 ❌ ERROR 〕━━━⬣\n` +
      `┃ No se pudo descargar la app.\n┃\n` +
      `┃ 🔎 ${errMsg}\n` +
      `╰━━━━━━━━━━━━━━━━⬣`;

    if (errMsg.includes("502") || errMsg.includes("Bad Gateway")) {
      humanError =
        `╭━━━〔 ⚠️ SERVIDOR OCUPADO 〕━━━⬣\n` +
        `┃ La API está saturada o caída.\n┃\n` +
        `┃ 🔁 Intenta en unos minutos.\n` +
        `╰━━━━━━━━━━━━━━━━⬣`;
    }

    await sock.sendMessage(jid, { text: humanError }, { quoted: msg });

  } finally {
    try { await fs.emptyDir(TEMP_DIR); } catch {}
  }
}

export default {
  name: "apkdl",
  aliases: ["apk", "xapk", "app"],
  run: async (sock, msg, args, jid) => {
    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(jid, {
        text:
          `╭━━━〔 📦 APK DOWNLOAD 〕━━━⬣\n` +
          `┃ ❌ Debes escribir una app.\n┃\n` +
          `┃ 📌 Ejemplos:\n` +
          `┃ .apk whatsapp\n` +
          `┃ .xapk free fire\n` +
          `┃ .app minecraft\n` +
          `╰━━━━━━━━━━━━━━━━⬣`,
      }, { quoted: msg });
    }

    const cmd = msg?.message?.conversation
      ?.split(" ")[0]?.replace(".", "")?.toLowerCase() || "apk";

    await descargarApk(sock, msg, jid, query, cmd === "xapk" ? "xapk" : "apk");
  },
};