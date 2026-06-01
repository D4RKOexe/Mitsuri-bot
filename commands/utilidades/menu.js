import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP = {
  eco: "economia",
  jue: "juegos",
  ia: "ia",
  gru: "grupos",
  adm: "admin",
  des: "descargas",
  bus: "busqueda",
  emo: "emoji",
  env: "envia",
  eve: "eventos",
  med: "media",
  nov: "novedades",
  nsfw: "nsfw",
  own: "owner",
  per: "perfil",
  prs: "personal",
  stk: "stickers",
  trm: "termux",
  trb: "trabajos",
  uti: "utilidades",
  inf: "info",
  mem: "comandosdemibro"
};

const ICONS = {
  eco: "💰",
  jue: "🎮",
  ia: "🤖",
  gru: "👥",
  adm: "🛡️",
  des: "⬇️",
  bus: "🔎",
  emo: "😀",
  env: "📨",
  eve: "📅",
  med: "🎵",
  nov: "📰",
  nsfw: "🔞",
  own: "👑",
  per: "👤",
  prs: "📁",
  stk: "🖼️",
  trm: "💻",
  trb: "🛠️",
  uti: "🔧",
  inf: "ℹ️",
  mem: "⭐"
};

export default {
  name: "m",
  aliases: [
    "menu",
    "help",
    "c",
    "eco",
    "jue",
    "ia",
    "gru",
    "adm",
    "des",
    "bus",
    "emo",
    "env",
    "eve",
    "med",
    "nov",
    "nsfw",
    "own",
    "per",
    "prs",
    "stk",
    "trm",
    "trb",
    "uti",
    "inf",
    "mem"
  ],

  async run(sock, msg, args, jid) {
    const { reply } = await import("../../utils.js");

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    const usado = body.slice(CONFIG.prefix.length).trim().split(" ")[0].toLowerCase();

    // MENU PRINCIPAL
    if (usado === "m" || usado === "menu" || usado === "help" || usado === "c") {

      let texto = `╭──〔 ${CONFIG.botName} 〕──⬣\n\n`;

      for (const key of Object.keys(MAP)) {
        texto += `${ICONS[key]} .${key}\n`;
      }

      texto += `\n📜 .all`;
      texto += `\n╰──────────────⬣`;

      return reply(sock, jid, texto, msg);
    }

    // CATEGORIA
    const carpeta = MAP[usado];
    if (!carpeta) return;

    const dir = path.join(__dirname, "../../commands", carpeta);

    let texto = `╭──〔 ${carpeta.toUpperCase()} 〕──⬣\n\n`;

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

    for (const file of files) {
      try {
        const mod = await import(`file://${path.join(dir, file)}?u=${Date.now()}`);

        if (mod.default?.name) {
          texto += `◈ ${CONFIG.prefix}${mod.default.name}\n`;
        }
      } catch {}
    }

    texto += `\n╰──────────────⬣`;

    return reply(sock, jid, texto, msg);
  }
};