import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const VIDEO_AS_DOCUMENT_THRESHOLD = 50 * 1024 * 1024;

function safeFileName(name) {
  return String(name || "instagram-media")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "instagram-media";
}

function normalizeMediaFileName(name, mediaType = "video") {
  const raw = String(name || "").trim();
  const defaultExt = mediaType === "image" ? "jpg" : "mp4";
  const extMatch = raw.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : defaultExt;
  const base = safeFileName(raw.replace(/\.[^.]+$/i, "") || "instagram-media");
  return `${base}.${ext}`;
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function extractInstagramUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i
  );
  return match ? match[0].trim() : "";
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      if (error?.code === "ENOENT") {
        return reject(new Error(`${command} no está instalado o no está en el PATH.`));
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(stderr.trim() || `${command} terminó con código ${code}`));
    });
  });
}

async function getInstagramInfo(url) {
  const { stdout } = await runCommand("yt-dlp", [
    "--cookies-from-browser", "firefox",
    "--dump-single-json",
    "--no-warnings",
    url,
  ]);

  const data = JSON.parse(stdout);
  const mediaType = data?.ext === "jpg" || data?.ext === "jpeg" ? "image" : "video";

  return {
    title: safeFileName(data?.title || `Post by ${data?.uploader || "Instagram"}`),
    username: String(data?.uploader || data?.channel || "").trim() || null,
    thumbnail: data?.thumbnail || null,
    mediaType,
    fileName: normalizeMediaFileName(
      `${safeFileName(data?.title || "instagram-media")}.${mediaType === "image" ? "jpg" : "mp4"}`,
      mediaType
    ),
  };
}

async function downloadInstagramMedia(url, outputBase) {
  await runCommand("yt-dlp", [
    "--cookies-from-browser", "firefox",
    "-f", "bv*+ba/b",
    "--merge-output-format", "mp4",
    "-o", `${outputBase}.%(ext)s`,
    "--no-playlist",
    "--no-warnings",
    url,
  ]);

  const possibleFiles = [
    `${outputBase}.mp4`, `${outputBase}.mkv`, `${outputBase}.webm`,
    `${outputBase}.jpg`, `${outputBase}.jpeg`, `${outputBase}.png`,
  ];

  const found = possibleFiles.find((f) => fs.existsSync(f));
  if (!found) throw new Error("No se encontró el archivo descargado.");

  const size = fs.statSync(found).size;
  if (!size || size < 30000) { deleteFileSafe(found); throw new Error("Archivo inválido."); }
  if (size > MAX_MEDIA_BYTES) { deleteFileSafe(found); throw new Error("Archivo demasiado grande para WhatsApp."); }

  return { filePath: found, size };
}

async function convertVideoForWhatsApp(inputPath, outputPath) {
  await runCommand("ffmpeg", [
    "-y", "-i", inputPath,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
    "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-level", "3.0",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart", "-shortest", "-loglevel", "error",
    outputPath,
  ]);

  if (!fs.existsSync(outputPath)) throw new Error("No se pudo convertir el video.");
  return outputPath;
}

export default {
  name: "instagram",
  aliases: ["ig", "igdl"],
  run: async (sock, msg, args, jid) => {
    const quoted = { quoted: msg };
    const text = Array.isArray(args) ? args.join(" ") : "";
    const postUrl = extractInstagramUrl(text);

    if (!postUrl) {
      return reply(sock, jid,
        "❌ *Uso:*\n`.ig <link>`\n`.instagram <link>`",
        msg
      );
    }

    let rawPath = null;
    let finalPath = null;

    try {
      try { await sock.sendMessage(jid, { react: { text: "⏳", key: msg.key } }); } catch {}
      await reply(sock, jid, "📸 *Descargando de Instagram...*", msg);

      const info = await getInstagramInfo(postUrl);

      // Enviar preview con miniatura
      if (info.thumbnail) {
        const previewLines = ["📸 *Instagram*", "", `📌 ${info.title}`];
        if (info.username) previewLines.push(`👤 ${info.username}`);
        await sock.sendMessage(jid, {
          image: { url: info.thumbnail },
          caption: previewLines.join("\n"),
        }, quoted);
      }

      const outputBase = path.join(TEMP_DIR, `${Date.now()}-ig`);
      const downloaded = await downloadInstagramMedia(postUrl, outputBase);
      rawPath = downloaded.filePath;

      let sendPath = rawPath;
      let sendSize = downloaded.size;
      const ext = path.extname(rawPath).toLowerCase();

      // Convertir video si es necesario
      if (info.mediaType === "video" || [".mp4", ".mkv", ".webm"].includes(ext)) {
        finalPath = path.join(TEMP_DIR, `${Date.now()}-final.mp4`);
        await convertVideoForWhatsApp(rawPath, finalPath);
        sendPath = finalPath;
        sendSize = fs.statSync(finalPath).size;
      }

      const caption =
        `📸 *${info.title}*\n` +
        (info.username ? `👤 ${info.username}\n` : "") +
        `#Instagram`;

      // Imagen
      if ([".jpg", ".jpeg", ".png"].includes(path.extname(sendPath).toLowerCase())) {
        await sock.sendMessage(jid, { image: { url: sendPath }, caption }, quoted);
        try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}
        return;
      }

      // Video grande → documento
      if (sendSize > VIDEO_AS_DOCUMENT_THRESHOLD) {
        await sock.sendMessage(jid, {
          document: { url: sendPath },
          mimetype: "video/mp4",
          fileName: normalizeMediaFileName(info.fileName, "video"),
          caption: `${caption}\n📦 Enviado como documento`,
        }, quoted);
        try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}
        return;
      }

      // Video normal
      try {
        await sock.sendMessage(jid, {
          video: { url: sendPath },
          mimetype: "video/mp4",
          fileName: normalizeMediaFileName(info.fileName, "video"),
          caption,
        }, quoted);
      } catch {
        await sock.sendMessage(jid, {
          document: { url: sendPath },
          mimetype: "video/mp4",
          fileName: normalizeMediaFileName(info.fileName, "video"),
          caption: `${caption}\n📦 Enviado como documento`,
        }, quoted);
      }

      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (e) {
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
      await reply(sock, jid,
        `❌ ${String(e?.message || "No se pudo procesar Instagram.")}`,
        msg
      );
    } finally {
      deleteFileSafe(rawPath);
      deleteFileSafe(finalPath);
    }
  },
};