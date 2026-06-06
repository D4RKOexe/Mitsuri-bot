import * as cheerio from "cheerio";
import { reply } from "../../utils.js";

const PACKS_LIMIT    = 3;
const STICKERS_LIMIT = 8;

async function searchStickerPacks(searchTerm) {
  const url = `https://getstickerpack.com/stickers?query=${encodeURIComponent(searchTerm)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const packs = [];

  $(".sticker-pack-cols").each((i, el) => {
    if (packs.length >= PACKS_LIMIT) return;
    const linkTag = $(el).find("a");
    const packUrl = linkTag.attr("href");
    const title   = $(el).find(".title").text().trim();
    const author  = $(el).find(".username").text().trim() || "Desconocido";

    if (packUrl && title) {
      packs.push({
        title,
        author,
        pack_url: packUrl.startsWith("http") ? packUrl : `https://getstickerpack.com${packUrl}`,
        stickers: [],
      });
    }
  });

  for (const pack of packs) {
    try {
      const resPack = await fetch(pack.pack_url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!resPack.ok) continue;
      const $pack = cheerio.load(await resPack.text());

      $pack(".sticker-image").each((i, el) => {
        if (pack.stickers.length >= STICKERS_LIMIT) return;
        let src = $pack(el).attr("data-src-large") || $pack(el).attr("src");
        if (src) {
          if (src.startsWith("//")) src = "https:" + src;
          pack.stickers.push(src);
        }
      });
    } catch {}
  }

  return packs;
}

export default {
  name: "spack",
  aliases: ["stickers", "stickerpack"],
  run: async (sock, msg, args, jid) => {
    const query = args.join(" ").trim();

    if (!query) {
      return reply(sock, jid,
        "❌ Escribe qué stickers buscar.\n\n📌 Ejemplo: `.spack anime`",
        msg
      );
    }

    try { await sock.sendMessage(jid, { react: { text: "🔍", key: msg.key } }); } catch {}
    await reply(sock, jid, `🔍 Buscando packs de: *${query}*...`, msg);

    try {
      const packs = await searchStickerPacks(query);

      if (!packs.length) {
        try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
        return reply(sock, jid, `❌ No encontré packs para: *${query}*`, msg);
      }

      for (const pack of packs) {
        if (!pack.stickers.length) continue;

        await reply(sock, jid,
          `📦 *${pack.title}*\n👤 Por: ${pack.author}\n🖼️ Enviando ${pack.stickers.length} stickers...`,
          msg
        );

        for (const stickerUrl of pack.stickers) {
          try {
            const response = await fetch(stickerUrl, {
              headers: { "User-Agent": "Mozilla/5.0" }
            });

            const contentType = response.headers.get("content-type") || "";
            console.log("[SPACK] content-type:", contentType, stickerUrl);
            const buffer = Buffer.from(await response.arrayBuffer());

            await sock.sendMessage(jid, {
              sticker: buffer,
            }, { quoted: msg });

          } catch {
            // Fallback como imagen
            try {
              await sock.sendMessage(jid, {
                image: { url: stickerUrl },
              }, { quoted: msg });
            } catch {}
          }
        }
      }

      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

    } catch (e) {
      console.error("[SPACK ERROR]", e.message);
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};