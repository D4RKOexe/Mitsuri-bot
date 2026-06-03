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

const ICONS = {
  eco:  "💰", jue:  "🎮", ia:   "🤖", gru:  "👥",
  adm:  "🛡️", des:  "⬇️", bus:  "🔎", emo:  "😀",
  env:  "📨", eve:  "📅", med:  "🎵", nov:  "📰",
  nsfw: "🔞", own:  "👑", per:  "👤", prs:  "📁",
  stk:  "🖼️", trm:  "💻", trb:  "🛠️", uti:  "🔧",
  inf:  "ℹ️",  mem:  "⭐"
};

const LABELS = {
  eco:  "Economía",    jue:  "Juegos",          ia:   "Inteligencia IA",
  gru:  "Grupos",      adm:  "Admin",            des:  "Descargas",
  bus:  "Búsqueda",    emo:  "Emojis",           env:  "Envíos",
  eve:  "Eventos",     med:  "Media",            nov:  "Novedades",
  nsfw: "NSFW",        own:  "Owner",            per:  "Perfil",
  prs:  "Personal",    stk:  "Stickers",         trm:  "Termux",
  trb:  "Trabajos",    uti:  "Utilidades",       inf:  "Info",
  mem:  "Mis Comandos"
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
      let txt = "";

      txt += `╭━━━━━━━━━━━━━━━━━━━━━━╮\n`;
      txt += `┃  🌸 *MITSURI-BOT* 🌸   ┃\n`;
      txt += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

      txt += `🌸 *Elige una categoría:*\n`;
      txt += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n`;

      for (const key of Object.keys(MAP)) {
        txt += `${ICONS[key]} *${CONFIG.prefix}${key}*  —  ${LABELS[key]}\n`;
      }

      txt += `\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
      txt += `> 💡 _Escribe ${CONFIG.prefix}eco, ${CONFIG.prefix}jue, etc._\n`;
      txt += `🌸 *MITSURI-BOT* — con amor 💕`;

      return reply(sock, jid, txt, msg);
    }

    // ══════════════════════════════════════════
    //  CATEGORÍA
    // ══════════════════════════════════════════
    const carpeta = MAP[usado];
    if (!carpeta) return;

    const dir   = path.join(__dirname, "../../commands", carpeta);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

    const cmds = [];
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
    const label = LABELS[usado] ?? carpeta.toUpperCase();

    let txt = "";
    txt += `╭━━━━━━━━━━━━━━━━━━━━━━╮\n`;
    txt += `┃  ${icon} *${label.toUpperCase()}*\n`;
    txt += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    if (cmds.length === 0) {
      txt += `_No hay comandos en esta categoría._\n`;
    } else {
      for (const cmd of cmds) {
        txt += `🌸 *${CONFIG.prefix}${cmd.name}*\n`;

        if (cmd.aliases.length > 0) {
          const al = cmd.aliases.map(a => `${a}`).join(", ");
          txt += `   ✦ _Alias: ${al}_\n`;
        }

        if (cmd.desc) {
          txt += `   ✦ _${cmd.desc}_\n`;
        }

        txt += `\n`;
      }
    }

    txt += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
    txt += `🔙 _${CONFIG.prefix}menu  →  volver al inicio_\n`;
    txt += `🌸 *MITSURI-BOT* 💕`;

    return reply(sock, jid, txt, msg);
  }
};