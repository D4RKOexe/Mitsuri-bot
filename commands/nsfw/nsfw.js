import axios from "axios";
import fs from "fs";
import path from "path";
import { reply } from "../../utils.js";

const DB_PATH = path.resolve("./data/nsfw_groups.json");

// Categorías de nekobot
const NEKOBOT_CATEGORIES = {
  "4k":       ["4k"],
  "ass":      ["cola", "culo"],
  "boobs":    ["pechos", "tetas"],
  "pgif":     ["gif"],
  "lesbian":  ["lesbiana"],
  "hentai":   ["hentai"],
  "blowjob":  ["bj"],
  "feet":     ["pies"],
  "thigh":    ["muslos"],
  "ahegao":   ["ahegao"],
  "anal":     ["anal"],
};

// Categorías de delirius (nuevas)
const DELIRIUS_CATEGORIES = {
  "corean":   ["coreana", "kgirl"],
  "boobs2":   ["tetas2", "pechos2"],   // boobs ya existe en nekobot, se accede como "boobs2"
  "girls":    ["chicas", "nenas"],
  "tiktok18": ["ttnsfw", "tiktoknsfw"],
};

// Mapa inverso alias -> { categoria, source }
const ALIAS_MAP = {};
for (const [cat, aliases] of Object.entries(NEKOBOT_CATEGORIES)) {
  ALIAS_MAP[cat] = { categoria: cat, source: "nekobot" };
  for (const alias of aliases) ALIAS_MAP[alias] = { categoria: cat, source: "nekobot" };
}
for (const [cat, aliases] of Object.entries(DELIRIUS_CATEGORIES)) {
  // El endpoint real en delirius (boobs2 -> boobs, tiktok18 -> tiktok)
  const endpoint = cat.replace("boobs2", "boobs").replace("tiktok18", "tiktok");
  ALIAS_MAP[cat] = { categoria: endpoint, source: "delirius" };
  for (const alias of aliases) ALIAS_MAP[alias] = { categoria: endpoint, source: "delirius" };
}

function buildMenu() {
  const lines = ["🔞 *Categorías NSFW disponibles*\n"];

  lines.push("🌐 *Nekobot*");
  for (const [cat, aliases] of Object.entries(NEKOBOT_CATEGORIES)) {
    const aliasStr = aliases.length > 0 ? `  _(${aliases.join(", ")})_` : "";
    lines.push(`▸ *${cat}*${aliasStr}`);
  }

  lines.push("\n🎌 *Delirius*");
  for (const [cat, aliases] of Object.entries(DELIRIUS_CATEGORIES)) {
    const aliasStr = aliases.length > 0 ? `  _(${aliases.join(", ")})_` : "";
    lines.push(`▸ *${cat}*${aliasStr}`);
  }

  lines.push("\n📌 *Uso:* .nsfw <categoría o alias>");
  lines.push("📌 *Ejemplo:* .nsfw hentai | .nsfw corean | .nsfw tiktok18");
  lines.push("\n⚙️ *Admins:*");
  lines.push("▸ .nsfw on — activar NSFW en el grupo");
  lines.push("▸ .nsfw off — desactivar NSFW en el grupo");
  return lines.join("\n");
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function isNsfwEnabled(jid) {
  const db = loadDB();
  return db.groups?.[jid]?.nsfw === true;
}

function setNsfw(jid, state) {
  const db = loadDB();
  if (!db.groups[jid]) db.groups[jid] = {};
  db.groups[jid].nsfw = state;
  saveDB(db);
}

export default {
  name: "nsfw",
  run: async (sock, msg, args, jid) => {
    try {
      const input = (args[0] || "").toLowerCase();

      // --- Menú ---
      if (!input || input === "menu" || input === "ayuda" || input === "help") {
        if (!isNsfwEnabled(jid)) {
          return reply(sock, jid, "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*", msg);
        }
        return reply(sock, jid, buildMenu(), msg);
      }

      // --- Control de activación (solo admins) ---
      if (input === "on" || input === "off") {
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNum = sender.split("@")[0].split(":")[0].trim();

        const BOT_OWNER_NUM = "573223090406";
        const BOT_OWNER_LID = "204148502954022";
        const isBotOwner = senderNum === BOT_OWNER_NUM || senderNum === BOT_OWNER_LID;

        if (isBotOwner) {
          const state = input === "on";
          setNsfw(jid, state);
          return reply(sock, jid, state ? "✅ NSFW activado en este grupo." : "🚫 NSFW desactivado en este grupo.", msg);
        }

        const groupMeta = await sock.groupMetadata(jid);
        const ownerNum = (groupMeta.owner || "").split("@")[0].split(":")[0].trim();
        const isOwner = ownerNum === senderNum;
        const isAdmin = groupMeta.participants.some((p) => {
          if (!p.admin) return false;
          const pNum = (p.id || "").split("@")[0].split(":")[0].trim();
          const pPhone = (p.phoneNumber || "").replace(/\D/g, "");
          return pNum === senderNum || pPhone === senderNum;
        });

        if (!isAdmin && !isOwner) {
          return reply(sock, jid, "❌ Solo los admins o el owner del grupo pueden activar/desactivar el NSFW.", msg);
        }

        const state = input === "on";
        setNsfw(jid, state);
        return reply(sock, jid, state ? "✅ NSFW activado en este grupo." : "🚫 NSFW desactivado en este grupo.", msg);
      }

      // --- Verificar si NSFW está activado ---
      if (!isNsfwEnabled(jid)) {
        return reply(sock, jid, "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*", msg);
      }

      // --- Resolver alias -> categoría y fuente ---
      const match = ALIAS_MAP[input];
      if (!match) {
        return reply(sock, jid, `❌ Categoría *"${input}"* no encontrada.\nEscribe *.nsfw menu* para ver todas las opciones.`, msg);
      }

      const { categoria, source } = match;

      // --- Nekobot ---
      if (source === "nekobot") {
        const { data } = await axios.get(`https://nekobot.xyz/api/image?type=${categoria}`);
        if (!data?.message) return reply(sock, jid, "❌ No pude obtener imagen, intenta de nuevo.", msg);

        await sock.sendMessage(jid, {
          image: { url: data.message },
          caption: `🔞 *${categoria.toUpperCase()}*`
        }, { quoted: msg });
      }

      // --- Delirius ---
      if (source === "delirius") {
        const response = await axios.get(`https://api.delirius.store/nsfw/${categoria}`, {
          responseType: "arraybuffer"
        });

        const contentType = response.headers["content-type"] || "";
        const buffer = Buffer.from(response.data);

        if (contentType.includes("video")) {
          await sock.sendMessage(jid, {
            video: buffer,
            caption: `🔞 *${categoria.toUpperCase()}*`,
            mimetype: "video/mp4"
          }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, {
            image: buffer,
            caption: `🔞 *${categoria.toUpperCase()}*`
          }, { quoted: msg });
        }
      }

    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};