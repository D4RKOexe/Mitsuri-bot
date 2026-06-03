import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MAP = {
  eco:  "economia",   jue:  "juegos",     ia:   "ia",
  gru:  "grupos",     adm:  "admin",      des:  "descargas",
  bus:  "busqueda",   emo:  "emoji",      env:  "envia",
  eve:  "eventos",    med:  "media",      nov:  "novedades",
  nsfw: "nsfw",       own:  "owner",      per:  "perfil",
  prs:  "personal",   stk:  "stickers",   trm:  "termux",
  trb:  "trabajos",   uti:  "utilidades", inf:  "info",
  mem:  "comandosdemibro"
};

// Nombre bonito de cada categoría (se muestra como sección)
const LABELS = {
  eco:  "єcσησмíα",   jue:  "נυєgσѕ",      ia:   "ιηтєℓιgєηcια",
  gru:  "gяυρσѕ",     adm:  "α∂мιη",        des:  "∂єѕcαяgαѕ",
  bus:  "вúѕqυє∂α",   emo:  "ємσנιѕ",       env:  "єηνíσѕ",
  eve:  "єνєηтσѕ",    med:  "мє∂ια",        nov:  "ησνє∂α∂єѕ",
  nsfw: "ηѕfw",       own:  "σωηєя",        per:  "ρєяƒιℓ",
  prs:  "ρєяѕσηαℓ",   stk:  "ѕтιckєяѕ",    trm:  "тєямυχ",
  trb:  "тяαвαנσѕ",   uti:  "υтιℓι∂α∂єѕ",  inf:  "ιηƒσ",
  mem:  "мιѕ cм∂ѕ"
};

const ICONS = {
  eco:  "💰", jue:  "🎮", ia:   "🤖", gru:  "👥",
  adm:  "🛡️", des:  "⬇️", bus:  "🔎", emo:  "😀",
  env:  "📨", eve:  "📅", med:  "🎵", nov:  "📰",
  nsfw: "🔞", own:  "👑", per:  "👤", prs:  "📁",
  stk:  "🖼️", trm:  "💻", trb:  "🛠️", uti:  "🔧",
  inf:  "ℹ️",  mem:  "⭐"
};

// Imagen de portada del menú — cambia la URL por la tuya
const BANNER_URL = "https://files.catbox.moe/qas49d.png";

export default {
  name: "m",
  aliases: [
    "menu","help","c",
    "eco","jue","ia","gru","adm","des","bus","emo","env",
    "eve","med","nov","nsfw","own","per","prs","stk","trm",
    "trb","uti","inf","mem"
  ],

  async run(sock, msg, args, jid) {
    const { reply } = await import("../../utils.js");

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || "";

    const usado = body.slice(CONFIG.prefix.length).trim().split(" ")[0].toLowerCase();

    // ══════════════════════════════════════════
    //  MENÚ PRINCIPAL  (con imagen)
    // ══════════════════════════════════════════
    if (["m","menu","help","c"].includes(usado)) {
      const hora = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit", minute: "2-digit",
        day: "numeric", month: "numeric", year: "numeric"
      });

      // Contar usuarios y comandos (ajusta si tienes acceso a db/plugins)
      let totalCmds = 0;
      for (const carpeta of Object.values(MAP)) {
        const dir = path.join(__dirname, "../../commands", carpeta);
        if (fs.existsSync(dir)) {
          totalCmds += fs.readdirSync(dir).filter(f => f.endsWith(".js")).length;
        }
      }

      let txt = "";
      txt += `¡Hola! ◝(ᵔᵕᵔ)◜ Soy 🌸 *MITSURI-BOT* 🌸,\n`;
      txt += `un gusto conocerte. Estoy aquí para lo que necesites ♡\n\n`;

      txt += `⊹ ˚₊ *DEVELOPERS ::* BrayanRK BY Draven\n`;
      txt += `⊹ ˚₊ *TIPO ::* Bot\n`;
      txt += `⊹ ˚₊ *TIME ::* ${hora}\n`;
      txt += `⊹ ˚₊ *CMDS ::* ${totalCmds}\n\n`;

      // Categorías en texto estilo menú
      for (const key of Object.keys(MAP)) {
        txt += `⊹ ˚₊ ${ICONS[key]} *${LABELS[key]}*\n`;
        txt += `   ↓ _Usa ${CONFIG.prefix}${key} para ver sus comandos_\n`;
      }

      txt += `\n> 🌸 *MITSURI-BOT* desarrollado por *BrayanRK & El Vigilante* ◝(˶ᵔᵕᵔ˶)ა`;

      // Enviar con imagen (igual que el bot de la foto)
      return sock.sendMessage(jid, {
        image: { url: BANNER_URL },
        caption: txt
      }, { quoted: msg });
    }

    // ══════════════════════════════════════════
    //  CATEGORÍA
    // ══════════════════════════════════════════
    const carpeta = MAP[usado];
    if (!carpeta) return;

    const dir   = path.join(__dirname, "../../commands", carpeta);
    if (!fs.existsSync(dir)) return reply(sock, jid, "❌ Categoría no encontrada.", msg);

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
    const cmds  = [];

    for (const file of files) {
      try {
        const mod = await import(`file://${path.join(dir, file)}?u=${Date.now()}`);
        const d   = mod.default;
        if (d?.name) {
          cmds.push({
            name:    d.name,
            aliases: Array.isArray(d.aliases) ? d.aliases : [],
            desc:    d.description || d.desc || ""
          });
        }
      } catch {}
    }

    const icon  = ICONS[usado]  ?? "🌸";
    const label = LABELS[usado] ?? carpeta;

    let txt = "";
    txt += `⊹ ˚₊ ${icon} *${label}* ${icon} ˚₊ ⊹\n\n`;

    for (const cmd of cmds) {
      txt += `⊹ ˚₊ *${CONFIG.prefix}${cmd.name}*\n`;

      if (cmd.aliases.length > 0) {
        const al = cmd.aliases.map(a => `${CONFIG.prefix}${a}`).join(", ");
        txt += `   ✦ _Alias: ${al}_\n`;
      }

      if (cmd.desc) {
        txt += `   ✦ _${cmd.desc}_\n`;
      }

      txt += `\n`;
    }

    txt += `> 🌸 *MITSURI-BOT* — _${CONFIG.prefix}menu para volver_ 💕`;

    return reply(sock, jid, txt, msg);
  }
};