import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { reply } from "../../utils.js";

// ─── Persistencia ─────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "waifu_groups.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readJsonSync(DATA_FILE);
      return new Set(raw);
    }
  } catch (e) {
    console.error("⚠️ waifu: error cargando datos:", e.message);
  }
  return new Set();
}

function saveData(set) {
  try {
    fs.writeJsonSync(DATA_FILE, [...set], { spaces: 2 });
  } catch (e) {
    console.error("⚠️ waifu: error guardando datos:", e.message);
  }
}

// Grupos donde waifu está HABILITADO (cargado desde disco al arrancar)
export const waifuEnabledGroups = loadData();

// ─── Helpers de permisos ──────────────────────────────────────────────────────
const OWNER_NUMBER = "573223090406"; // ← TU NÚMERO

function normalizeJid(jid) {
  if (!jid) return "";
  return jid.split("@")[0].split(":")[0];
}

function isOwner(userJid) {
  return normalizeJid(userJid) === OWNER_NUMBER;
}

async function isGroupAdmin(sock, jid, userJid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(
      (p) => normalizeJid(p.id) === normalizeJid(userJid)
    );
    return (
      !!participant &&
      (participant.admin === "admin" || participant.admin === "superadmin")
    );
  } catch {
    return false;
  }
}

async function canToggle(sock, jid, sender) {
  if (isOwner(sender)) return true;
  if (jid?.endsWith("@g.us")) return await isGroupAdmin(sock, jid, sender);
  return false;
}

// ─── Categorías ───────────────────────────────────────────────────────────────
const CATEGORIES = {
  "catgirl":                ["neko", "gata"],
  "foxgirl":                ["kitsune", "zorra"],
  "wolfgirl":               ["lobo", "wolf"],
  "random":                 ["rand", "aleatorio"],
  "girl":                   ["chica"],
  "young-girl":             ["joven"],
  "animal-ears":            ["orejas"],
  "tail":                   ["cola"],
  "tail-with-ribbon":       ["cola-cinta"],
  "tail-from-under-skirt":  ["cola-falda"],
  "thigh-high-socks":       ["medias-altas", "thigh"],
  "knee-high-socks":        ["medias-rodilla", "knee"],
  "white-tights":           ["medias-blancas"],
  "black-tights":           ["medias-negras"],
  "uniform":                ["uniforme"],
  "sailor-uniform":         ["marinera", "sailor"],
  "hoodie":                 ["sudadera"],
  "ribbon":                 ["cinta", "lazo"],
  "maid":                   ["sirvienta", "criada"],
  "maid-uniform":           ["uniforme-maid"],
  "headphones":             ["audifonos"],
  "white-hair":             ["pelo-blanco"],
  "blue-hair":              ["pelo-azul"],
  "long-hair":              ["pelo-largo"],
  "blonde":                 ["rubia"],
  "blue-eyes":              ["ojos-azules"],
  "purple-eyes":            ["ojos-morados"],
  "heterochromia":          ["ojos-distintos", "hetero"],
  "cute":                   ["kawaii", "tierna"],
  "cuteness-is-justice":    ["justicia"],
  "wink":                   ["guino"],
  "w-sitting":              ["sentada"],
  "lying-down":             ["acostada"],
  "hands-forming-a-heart":  ["corazon"],
  "valentine":              ["san-valentin"],
  "blue-archive":           ["ba"],
  "vtuber":                 ["vt"],
};

const ALIAS_MAP = {};
for (const [cat, aliases] of Object.entries(CATEGORIES)) {
  ALIAS_MAP[cat] = cat;
  for (const alias of aliases) {
    ALIAS_MAP[alias] = cat;
  }
}

function buildMenu(jid) {
  const isGroup = jid?.endsWith("@g.us");
  const estado = isGroup
    ? waifuEnabledGroups.has(jid) ? "🟢 ON" : "🔴 OFF"
    : "✅ Siempre activo en privado";

  const lines = [
    `🌸 *Waifu* — Estado: ${estado}\n`,
    ...Object.entries(CATEGORIES).map(([cat, aliases]) => {
      const aliasStr = aliases.length > 0 ? `  _(${aliases.join(", ")})_` : "";
      return `▸ *${cat}*${aliasStr}`;
    }),
    "\n📌 *Uso:* .waifu <categoría o alias>",
    "📌 *Ejemplo:* .waifu neko | .waifu rubia | .waifu sailor",
    "📌 *Encender/apagar (admins y owner):*",
    "   .waifu on  — habilita en este grupo",
    "   .waifu off — deshabilita en este grupo",
  ];
  return lines.join("\n");
}

// ─── Comando principal ────────────────────────────────────────────────────────
export default {
  name: "waifu",
  run: async (sock, msg, args, jid, sender) => {
    try {
      const input = (args[0] || "").toLowerCase();
      const isGroup = jid?.endsWith("@g.us");

      // ── Subcomandos on/off ──────────────────────────────────────────────
      if (input === "on" || input === "off") {
        if (!isGroup) {
          return reply(sock, jid, "❌ Este ajuste solo aplica en grupos.", msg);
        }

        const puedeToggle = await canToggle(sock, jid, sender);
        if (!puedeToggle) {
          return reply(
            sock,
            jid,
            "❌ Solo los admins del grupo o el owner pueden hacer eso.",
            msg
          );
        }

        if (input === "on") {
          waifuEnabledGroups.add(jid);
          saveData(waifuEnabledGroups);
          return reply(sock, jid, "✅ Waifu *activado* en este grupo.", msg);
        } else {
          waifuEnabledGroups.delete(jid);
          saveData(waifuEnabledGroups);
          return reply(sock, jid, "🔴 Waifu *desactivado* en este grupo.", msg);
        }
      }

      // ── Bloqueo en grupos sin permiso ───────────────────────────────────
      if (isGroup && !waifuEnabledGroups.has(jid)) {
        return reply(
          sock,
          jid,
          "❌ El comando waifu no está habilitado aquí.\nUn admin puede usar *.waifu on* para activarlo.",
          msg
        );
      }

      // ── Menú ────────────────────────────────────────────────────────────
      if (!input || input === "help" || input === "ayuda" || input === "menu") {
        return reply(sock, jid, buildMenu(jid), msg);
      }

      // ── Buscar categoría ────────────────────────────────────────────────
      const categoria = ALIAS_MAP[input];
      if (!categoria) {
        return reply(
          sock,
          jid,
          `❌ Categoría *"${input}"* no encontrada.\nEscribe *.waifu menu* para ver todas las opciones.`,
          msg
        );
      }

      const { data } = await axios.get(
        `https://api.nekosia.cat/api/v1/images/${categoria}`,
        { params: { rating: "safe" } }
      );

      if (!data?.success || !data?.image?.compressed?.url) {
        return reply(sock, jid, "❌ No pude obtener imagen, intenta de nuevo.", msg);
      }

      const imageUrl = data.image.compressed.url;
      const artist = data.attribution?.artist?.username || "Desconocido";
      const character = data.anime?.character || null;
      const animeTitle = data.anime?.title || null;

      const captionLines = [`🏷️ Categoría: ${categoria}`];
      if (character) captionLines.push(`👤 Personaje: ${character}`);
      if (animeTitle) captionLines.push(`🎌 Anime: ${animeTitle}`);
      captionLines.push(`🎨 Artist: ${artist}`);

      await sock.sendMessage(
        jid,
        { image: { url: imageUrl }, caption: captionLines.join("\n") },
        { quoted: msg }
      );
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};