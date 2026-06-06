import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { pipeline } from "stream/promises";
import { Impit } from "impit";
import { TEMP_DIR } from "../../config.js";
import { reply } from "../../utils.js";

// ─── Scraper (sin API externa) ────────────────────────────────────────────────
const impit    = new Impit({ browser: "chrome" });
const RE_URL   = /(?:https?:\/\/)?(?:www\.|m\.|web\.|l\.)?facebook\.com\/[^\s<>"']+|fb\.watch\/[^\s<>"']+/i;
const RE_ID    = /\/reel\/(\d+)|[?&]v=(\d+)|\/videos\/(\d+)/;
const RE_SHORT = /\/share\/(?:v|r|p)\/|fb\.watch\//;
const HDR      = { accept: "text/html,application/xhtml+xml", "accept-language": "es-ES,es;q=0.9" };

const fbFetch = async (url, { headers = {}, timeout = 45_000, binary = false } = {}) => {
  const res  = await impit.fetch(url, { headers: { ...HDR, ...headers }, signal: AbortSignal.timeout(timeout) });
  const body = binary ? Buffer.from(await res.bytes()) : await res.text();
  return { status: res.status, url: res.url, body };
};

const reelPage = id => `https://www.facebook.com/reel/${id}`;
const reelId   = u  => (u.match(RE_ID) || []).slice(1).find(Boolean);
const unesc    = s  => s
  .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\\//g, "/");

const parseNum = v => {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[^\d.,KMB]/gi, "").replace(",", "."));
  if (Number.isNaN(n)) return null;
  const u = String(v).toUpperCase();
  if (/K|MIL/.test(u)) return Math.round(n * 1e3);
  if (/M/.test(u))     return Math.round(n * 1e6);
  return Math.round(n);
};

const fromTitle  = (t, k) => parseNum(t?.match(new RegExp(`([\\d.,]+)\\s*(mil|k|m)?\\s*${k}`, "i"))?.[0]);
const beforePost = (h, pid, re) => h.match(new RegExp(`${re.source}[\\s\\S]{0,8000}?"post_id":"${pid}"`))?.[1];

function parseStats(h, id) {
  const ogT  = h.match(/property="og:title" content="([^"]+)"/i)?.[1];
  const ogD  = h.match(/property="og:description" content="([^"]+)"/i)?.[1];
  const pid  = h.match(new RegExp(`"video":\\{"id":"${id}"[\\s\\S]{0,12000}?"post_id":"(\\d+)"`))?.[1]
            || h.match(/"post_id":"(\d+)"/)?.[1];
  const last = ogT?.split("|").pop()?.trim();
  return {
    reelId:      id,
    url:         reelPage(id),
    description: ogD || (last && !/views|reproducciones|reactions|reacciones/i.test(last) ? last : null),
    views:       +(h.match(/"(?:play|video_view|view)_count":(\d+)/)?.[1] || "") || fromTitle(ogT, "reproducciones|views?"),
    reactions:   pid ? +(beforePost(h, pid, /"unified_reactors":\{"count":(\d+)/) || "") : fromTitle(ogT, "reacciones|reactions?"),
    comments:    pid ? +(beforePost(h, pid, /"total_comment_count":(\d+)/) || "")  : null,
    shares:      pid ? parseNum(beforePost(h, pid, /"share_count_reduced":"([^"]+)"/)) : null,
  };
}

function parseVideo(h, id) {
  const c = h.includes(`"id":"${id}"`) ? h.slice(h.indexOf(`"id":"${id}"`), h.indexOf(`"id":"${id}"`) + 25_000) : h;
  const m = re => (c.match(re) || h.match(re))?.[1];
  return unesc(
    m(/"browser_native_hd_url":"((?:\\.|[^"\\])+)"/) ||
    m(/"browser_native_sd_url":"((?:\\.|[^"\\])+)"/) || ""
  );
}

async function getReel(text) {
  const raw  = String(text || "").trim();
  const link = (raw.match(RE_URL)?.[0] || raw.split(/\s+/)[0])?.replace(/[.,;:!?)]+$/, "");
  if (!link) return null;

  const source = link.startsWith("http") ? link : `https://${link}`;
  let id   = reelId(source);
  let html;

  if (!id && RE_SHORT.test(source)) {
    const r = await fbFetch(source);
    id   = reelId(r.url) || r.body.match(/\/reel\/(\d+)/)?.[1];
    html = r.body;
    if (!id) return null;
  }

  if (!id) return null;

  if (!html) {
    const r = await fbFetch(reelPage(id));
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    if (/login|two_step_verification/i.test(r.url)) throw new Error("Reel privado o requiere login");
    html = r.body;
  }

  const stats    = parseStats(html, id);
  stats.videoUrl = parseVideo(html, id);
  return stats;
}

// ─── Caption ──────────────────────────────────────────────────────────────────
const fmt = n =>
  n == null ? "—" :
  n >= 1e6  ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` :
  n >= 1e4  ? `${Math.round(n / 1e3)}K` :
  `${n}`;

const buildCaption = (s, sizeMB) =>
  `✅ *Facebook Reel*\n\n` +
  `🎬 ${s.description || "Reel"}\n\n` +
  `👁️ *${fmt(s.views)}*  ❤️ *${fmt(s.reactions)}*  💬 *${fmt(s.comments)}*  ↗️ *${fmt(s.shares)}*\n\n` +
  `🔗 ${s.url}` +
  (sizeMB ? `\n📦 ${sizeMB}MB` : "");

// ─── Comando ──────────────────────────────────────────────────────────────────
export default {
  name: "fb",
  aliases: ["facebook", "fbmp4"],
  run: async (sock, msg, args, jid) => {
    const react = async (emoji) => {
      try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
    };

    const input = args.join(" ").trim();
    if (!input || !RE_URL.test(input)) {
      await react("❌");
      return reply(sock, jid, "❌ Envía un link válido de Facebook.\nEj: `.fb https://www.facebook.com/reel/ID`", msg);
    }

    await react("⏳");
    await reply(sock, jid, "⬇️ *Descargando Facebook...*", msg);
    await fs.ensureDir(TEMP_DIR);

    const output = path.join(TEMP_DIR, `fb_${Date.now()}.mp4`);

    try {
      // ── Scrapear reel ───────────────────────────────────────────────────
      const data = await getReel(input);

      if (!data) {
        await react("❌");
        return reply(sock, jid, "❌ Enlace inválido. Usa un link de /reel/ o /share/...", msg);
      }

      if (!data.views && !data.reactions && !data.comments) {
        await react("❌");
        return reply(sock, jid, "❌ Sin estadísticas. El reel puede ser privado o estar bloqueado.", msg);
      }

      if (!data.videoUrl) {
        await sock.sendMessage(jid, { text: buildCaption(data) }, { quoted: msg });
        await react("⚠️");
        return reply(sock, jid, "⚠️ Stats OK pero el video no está disponible.", msg);
      }

      console.log("[FB] Video URL:", data.videoUrl.slice(0, 80));

      // ── Descargar video ─────────────────────────────────────────────────
      const response = await axios.get(data.videoUrl, {
        responseType: "stream",
        timeout: 120_000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: data.url,
          Origin: "https://www.facebook.com",
        },
      });

      await pipeline(response.data, fs.createWriteStream(output));

      const stat = await fs.stat(output);
      if (!stat.size || stat.size < 100_000) throw new Error("Video corrupto o vacío.");

      const sizeMB  = (stat.size / (1024 * 1024)).toFixed(1);
      const isLarge = stat.size > 99 * 1024 * 1024;
      const caption = buildCaption(data, sizeMB);

      // ── Enviar ──────────────────────────────────────────────────────────
      try {
        await sock.sendMessage(jid, {
          [isLarge ? "document" : "video"]: { url: output },
          mimetype: "video/mp4",
          fileName: `facebook_${data.reelId}.mp4`,
          caption,
        }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, {
          document: { url: output },
          mimetype: "video/mp4",
          fileName: `facebook_${data.reelId}.mp4`,
          caption,
        }, { quoted: msg });
      }

      await react("✅");
      await fs.unlink(output);

    } catch (e) {
      if (await fs.pathExists(output)) await fs.unlink(output).catch(() => {});
      console.error("[FB ERROR]", e.message);
      await react("❌");
      await reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};