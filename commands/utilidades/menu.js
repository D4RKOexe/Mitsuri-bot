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

// ══════════════════════════════════════════
//  🌸 PON AQUÍ TUS URLs — sube tus fotos en catbox.moe
// ══════════════════════════════════════════
const BANNER_MENU = "https://files.catbox.moe/zss154.png"; // portada principal

const BANNERS = {
  eco:  "https://files.catbox.moe/dem5ix.png", // 💰 Economía
  jue:  "https://files.catbox.moe/mzk0wk.png", // 🎮 Juegos
  ia:   "https://files.catbox.moe/suau1d.png", // 🤖 IA
  gru:  "https://files.catbox.moe/suau1d.png", // 👥 Grupos
  adm:  "https://files.catbox.moe/ck2vnb.png", // 🛡️ Admin
  des:  "https://files.catbox.moe/gp4xt6.png", // ⬇️ Descargas
  bus:  "https://files.catbox.moe/suau1d.png", // 🔎 Búsqueda
  emo:  "https://files.catbox.moe/suau1d.png", // 😀 Emojis
  env:  "https://files.catbox.moe/suau1d.png", // 📨 Envíos
  eve:  "https://files.catbox.moe/suau1d.png", // 📅 Eventos
  med:  "https://files.catbox.moe/suau1d.png", // 🎵 Media
  nov:  "https://files.catbox.moe/suau1d.png", // 📰 Novedades
  nsfw: "https://files.catbox.moe/suau1d.png", // 🔞 NSFW
  own:  "https://files.catbox.moe/xvf7k8.png", // 👑 Owner
  per:  "https://files.catbox.moe/suau1d.png", // 👤 Perfil
  prs:  "https://files.catbox.moe/suau1d.png", // 📁 Personal
  stk:  "https://files.catbox.moe/suau1d.png", // 🖼️ Stickers
  trm:  "https://files.catbox.moe/suau1d.png", // 💻 Termux
  trb:  "https://files.catbox.moe/suau1d.png", // 🛠️ Trabajos
  uti:  "https://files.catbox.moe/suau1d.png", // 🔧 Utilidades
  inf:  "https://files.catbox.moe/suau1d.png", // ℹ️ Info
  mem:  "https://files.catbox.moe/suau1d.png", // ⭐ Mis Comandos
};

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
    //  MENÚ PRINCIPAL
    // ══════════════════════════════════════════
    if (["m","menu","help","c"].includes(usado)) {
      const hora = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit", minute: "2-digit",
        day: "numeric", month: "numeric", year: "numeric"
      });

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
      txt += `⊹ ˚₊ *DEVELOPERS ::* BrayanRK By Draven\n`;
      txt += `⊹ ˚₊ *TIPO ::* Bot\n`;
      txt += `⊹ ˚₊ *TIME ::* ${hora}\n`;
      txt += `⊹ ˚₊ *CMDS ::* ${totalCmds}\n\n`;

      for (const key of Object.keys(MAP)) {
        txt += `⊹ ˚₊ ${ICONS[key]} *${LABELS[key]}*  →  _${CONFIG.prefix}${key}_\n`;
      }

      txt += `\n> 🌸 *MITSURI-BOT* desarrollado por *BrayanRK By Draven* ◝(˶ᵔᵕᵔ˶)ა`;

      return sock.sendMessage(jid, {
        image: { url: BANNER_MENU },
        caption: txt
      }, { quoted: msg });
    }

    // ══════════════════════════════════════════
    //  CATEGORÍA
    // ══════════════════════════════════════════
    const carpeta = MAP[usado];
    if (!carpeta) return;

    const dir = path.join(__dirname, "../../commands", carpeta);
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

    const icon   = ICONS[usado]   ?? "🌸";
    const label  = LABELS[usado]  ?? carpeta;
    const banner = BANNERS[usado];

    let txt = "";
    txt += `⊹ ˚₊ ${icon} *${label}* ${icon} ˚₊ ⊹\n\n`;

    for (const cmd of cmds) {
      txt += `🌸 *${CONFIG.prefix}${cmd.name}*\n`;

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

    // Con imagen si tiene banner, si no solo texto
    if (banner && !banner.includes("XXXXXXX")) {
      return sock.sendMessage(jid, {
        image: { url: banner },
        caption: txt
      }, { quoted: msg });
    }

    return reply(sock, jid, txt, msg);
  }
};