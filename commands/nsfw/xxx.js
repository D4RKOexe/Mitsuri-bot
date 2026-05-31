import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { reply } from "../../utils.js";

const DB_PATH = path.resolve("./data/nsfw_groups.json");
const searchSessions = new Map(); // sender -> resultados

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function isNsfwEnabled(jid) {
  const db = loadDB();
  return db.groups?.[jid]?.nsfw === true;
}

async function xnxxdl(URL) {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": "https://www.xnxx.com/"
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr("content") || $("title").text().trim();

  let files = {};
  const scripts = $("script").map((i, el) => $(el).html()).get().join("\n");

  const lowMatch = scripts.match(/html5player\.setVideoUrlLow\(['"](.+?)['"]\)/) ||
                   scripts.match(/setVideoUrlLow\(['"](.+?)['"]\)/) ||
                   scripts.match(/"low":"(https?:\/\/[^"]+)"/);

  const highMatch = scripts.match(/html5player\.setVideoUrlHigh\(['"](.+?)['"]\)/) ||
                    scripts.match(/setVideoUrlHigh\(['"](.+?)['"]\)/) ||
                    scripts.match(/"high":"(https?:\/\/[^"]+)"/);

  if (lowMatch) files.low = lowMatch[1];
  if (highMatch) files.high = highMatch[1];

  if (!files.low && !files.high) {
    console.log("[XNXX DEBUG] Scripts:", scripts.slice(0, 500));
  }

  // Obtener thumbnail
  const thumb = $('meta[property="og:image"]').attr("content") || null;

  let info = $("span.metadata").text() || "";
  let dur = info.match(/(\d+\s?min)/i)?.[0] || "Desconocida";
  let qual = info.match(/([0-9]{3,4}p)/i)?.[0] || "Desconocida";

  return { result: { title, thumb, info: { dur, qual }, files } };
}

async function search(query) {
  const page = Math.floor(Math.random() * 3) + 1;
  const url = `https://www.xnxx.com/search/${encodeURIComponent(query)}/${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.xnxx.com/"
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $("div.mozaique div.thumb-block").each((i, el) => {
    const href = $(el).find("a").first().attr("href");
    if (!href) return;
    const link = "https://www.xnxx.com" + href;
    const title = $(el).find("a").attr("title") ||
                  $(el).find(".thumb-under p").first().text().trim() ||
                  "Sin título";
    const thumb = $(el).find("img").attr("data-src") ||
                  $(el).find("img").attr("src") || null;
    results.push({ title, link, thumb });
  });

  return { result: results };
}

async function descargarVideo(sock, msg, jid, url) {
  await reply(sock, jid, "⏳ Descargando video, espera...", msg);

  const res = await xnxxdl(url);
  const dll = res.result.files.high || res.result.files.low;

  if (!dll) {
    return reply(sock, jid, "❌ No se pudo obtener el link del video.", msg);
  }

  const videoBuffer = await fetch(dll, {
    headers: { "User-Agent": "Mozilla/5.0" }
  }).then((r) => r.buffer());

  const caption =
    `*🔞 XNXX - DESCARGA*\n\n` +
    `📌 *${res.result.title}*\n` +
    `⏱️ Duración: ${res.result.info.dur}\n` +
    `📺 Calidad: ${res.result.info.qual}`;

  await sock.sendMessage(
    jid,
    { video: videoBuffer, caption, mimetype: "video/mp4" },
    { quoted: msg }
  );
}

export default {
  name: "xnxx",
  aliases: ["xx", "porno", "xxx"],
  run: async (sock, msg, args, jid, sender) => {
    try {
      if (!isNsfwEnabled(jid)) {
        return reply(
          sock,
          jid,
          "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*",
          msg
        );
      }

      const query = args.join(" ").trim();

      // --- Selección por número de sesión ---
      if (searchSessions.has(sender) && /^\d+$/.test(query)) {
        const session = searchSessions.get(sender);
        const index = parseInt(query) - 1;

        if (index < 0 || index >= session.length) {
          return reply(sock, jid, `❌ Número inválido, elige entre 1 y ${session.length}.`, msg);
        }

        searchSessions.delete(sender);
        await descargarVideo(sock, msg, jid, session[index].link);
        return;
      }

      if (!query) {
        return reply(
          sock,
          jid,
          "Ingresa el título o URL del video.\nEjemplo: *.xnxx mia khalifa*",
          msg
        );
      }

      // --- Descarga directa por URL ---
      if (query.includes("xnxx.com")) {
        await descargarVideo(sock, msg, jid, query);
        return;
      }

      // --- Búsqueda ---
      await reply(sock, jid, "🔍 Buscando...", msg);
      const res = await search(query);

      if (!res.result.length) {
        return reply(sock, jid, "❌ No se encontraron resultados.", msg);
      }

      const resultados = res.result.slice(0, 10);

      // Guardar sesión
      searchSessions.set(sender, resultados);
      // Limpiar sesión después de 2 minutos
      setTimeout(() => searchSessions.delete(sender), 120_000);

      // Enviar cada resultado con su thumbnail
      for (let i = 0; i < resultados.length; i++) {
        const v = resultados[i];
        const caption = `*${i + 1}.* ${v.title}`;

        if (v.thumb) {
          try {
            const imgBuffer = await fetch(v.thumb, {
              headers: { "User-Agent": "Mozilla/5.0" }
            }).then((r) => r.buffer());

            await sock.sendMessage(
              jid,
              { image: imgBuffer, caption },
              { quoted: msg }
            );
          } catch {
            await reply(sock, jid, caption, msg);
          }
        } else {
          await reply(sock, jid, caption, msg);
        }
      }

      await reply(
        sock,
        jid,
        `📎 Responde con el *número* del video que quieres descargar (tienes 2 minutos).`,
        msg
      );

    } catch (e) {
      console.error(e);
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};