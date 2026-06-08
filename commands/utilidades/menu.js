import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const COMMANDS_DIR = path.join(__dirname, "../../commands");
const ASSETS_DIR   = path.join(__dirname, "../../assets");

// ─── Metadatos por carpeta ────────────────────────────────────────────────────
const META = {
  economia:     { key: "eco",  icon: "💰", label: "𝘦𝘤𝘰𝘯𝘰𝘮𝘪́𝘢"        },
  juegos:       { key: "jue",  icon: "🎮", label: "𝘫𝘶𝘦𝘨𝘰𝘴"             },
  ia:           { key: "ia",   icon: "🤖", label: "𝘪𝘯𝘵𝘦𝘭𝘪𝘨𝘦𝘯𝘤𝘪𝘢"       },
  grupos:       { key: "gru",  icon: "👥", label: "𝘨𝘳𝘶𝘱𝘰𝘴"             },
  admin:        { key: "adm",  icon: "🛡️", label: "𝘢𝘥𝘮𝘪𝘯"              },
  descargas:    { key: "des",  icon: "⬇️", label: "𝘥𝘦𝘴𝘤𝘢𝘳𝘨𝘢𝘴"          },
  busqueda:     { key: "bus",  icon: "🔎", label: "𝘣𝘶́𝘴𝘲𝘶𝘦𝘥𝘢"           },
  emoji:        { key: "emo",  icon: "😀", label: "𝘦𝘮𝘰𝘫𝘪𝘴"             },
  envia:        { key: "env",  icon: "📨", label: "𝘦𝘯𝘷𝘪́𝘰𝘴"             },
  eventos:      { key: "eve",  icon: "📅", label: "𝘦𝘷𝘦𝘯𝘵𝘰𝘴"            },
  media:        { key: "med",  icon: "🎵", label: "𝘮𝘦𝘥𝘪𝘢"              },
  novedades:    { key: "nov",  icon: "📰", label: "𝘯𝘰𝘷𝘦𝘥𝘢𝘥𝘦𝘴"          },
  nsfw:         { key: "nsfw", icon: "🔞", label: "𝘯𝘴𝘧𝘸"               },
  owner:        { key: "own",  icon: "👑", label: "𝘰𝘸𝘯𝘦𝘳"              },
  perfil:       { key: "per",  icon: "👤", label: "𝘱𝘦𝘳𝘧𝘪𝘭"             },
  personal:     { key: "prs",  icon: "📁", label: "𝘱𝘦𝘳𝘴𝘰𝘯𝘢𝘭"           },
  stickers:     { key: "stk",  icon: "🖼️", label: "𝘴𝘵𝘪𝘤𝘬𝘦𝘳𝘴"          },
  termux:       { key: "trm",  icon: "💻", label: "𝘵𝘦𝘳𝘮𝘶𝘹"             },
  trabajos:     { key: "trb",  icon: "🛠️", label: "𝘵𝘳𝘢𝘣𝘢𝘫𝘰𝘴"          },
  utilidades:   { key: "uti",  icon: "🔧", label: "𝘶𝘵𝘪𝘭𝘪𝘥𝘢𝘥𝘦𝘴"         },
  info:         { key: "inf",  icon: "ℹ️",  label: "𝘪𝘯𝘧𝘰"              },
  hackingetico: { key: "mem",  icon: "⭐", label: "𝘩𝘢𝘤𝘬𝘪𝘯𝘨 𝘦́𝘵𝘪𝘤𝘰"      },
};

// ─── Banners locales ──────────────────────────────────────────────────────────
const BANNERS = {
  menu:         "menu.png",
  economia:     "economia.png",
  juegos:       "juegos.png",
  ia:           "ia.png",
  grupos:       "grupos.png",
  admin:        "admin.png",
  descargas:    "descargas.png",
  busqueda:     "busqueda.png",
  emoji:        "emoji.png",
  envia:        "envia.png",
  eventos:      "eventos.png",
  media:        "media.png",
  novedades:    "novedades.png",
  nsfw:         "nsfw.png",
  owner:        "owner.png",
  perfil:       "perfil.png",
  personal:     "personal.png",
  stickers:     "stickers.png",
  termux:       "termux.png",
  trabajos:     "trabajos.png",
  utilidades:   "utilidades.png",
  info:         "info.png",
  hackingetico: "hackingetico.png",
};

function getBanner(key) {
  const nombre = BANNERS[key];
  if (!nombre) return null;
  const ruta = path.join(ASSETS_DIR, nombre);
  return fs.existsSync(ruta) ? ruta : null;
}

function getCategorias() {
  if (!fs.existsSync(COMMANDS_DIR)) return [];
  return fs.readdirSync(COMMANDS_DIR)
    .filter(nombre => {
      const ruta = path.join(COMMANDS_DIR, nombre);
      return fs.statSync(ruta).isDirectory() && META[nombre];
    })
    .map(nombre => ({ carpeta: nombre, ...META[nombre] }));
}

function buildAliases() {
  const aliases = ["m", "menu", "help", "c"];
  for (const cat of getCategorias()) aliases.push(cat.key);
  return aliases;
}

async function leerComandos(carpeta) {
  const dir = path.join(COMMANDS_DIR, carpeta);
  if (!fs.existsSync(dir)) return [];
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
          desc:    d.description || d.desc || "",
        });
      }
    } catch {}
  }
  return cmds;
}

// ─── Decoración ───────────────────────────────────────────────────────────────
const L1  = `꧁༺ 🌸🌺🌹🌷🌸🌺🌹🌷🌸 ༻꧂`;
const L2  = `✦·····🌸·····✦·····🌸·····✦`;
const SEP = `🌸 ————————————————— 🌸`;

export default {
  name: "m",
  aliases: buildAliases(),

  async run(sock, msg, args, jid) {
    const { reply } = await import("../../utils.js");

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text || "";

    const usado = body.slice(CONFIG.prefix.length).trim().split(" ")[0].toLowerCase();
    const categorias = getCategorias();
    const keyMap     = Object.fromEntries(categorias.map(c => [c.key, c]));

    // ════════════════════════════════════════
    //  MENÚ PRINCIPAL
    // ════════════════════════════════════════
    if (["m", "menu", "help", "c"].includes(usado)) {
      const hora = new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit", minute: "2-digit",
        day: "numeric", month: "long", year: "numeric",
      });

      let totalCmds = 0;
      for (const { carpeta } of categorias) {
        const dir = path.join(COMMANDS_DIR, carpeta);
        if (fs.existsSync(dir)) {
          totalCmds += fs.readdirSync(dir).filter(f => f.endsWith(".js")).length;
        }
      }

      const nombre = msg.pushName || "usuario";

      let txt = "";
      txt += `${L1}\n`;
      txt += `\n`;
      txt += `🌸 *¡Hola, ${nombre}!* ◝(ᵔᵕᵔ)◜\n`;
      txt += `\n`;
      txt += `${SEP}\n`;
      txt += `\n`;
      txt += `🌸 *𝘔𝘐𝘛𝘚𝘜𝘙𝘐 𝘉𝘖𝘛* 🌸\n`;
      txt += `🌺 _𝘓𝘢 𝘭𝘭𝘢𝘮𝘢 𝘲𝘶𝘦 𝘯𝘶𝘯𝘤𝘢 𝘴𝘦 𝘢𝘱𝘢𝘨𝘢_ 🔥❤️\n`;
      txt += `\n`;
      txt += `${SEP}\n`;
      txt += `\n`;
      txt += `🌺 *𝘋𝘦𝘴𝘢𝘳𝘳𝘰𝘭𝘭𝘢𝘥𝘰 𝘱𝘰𝘳*\n`;
      txt += `🌸 _BrayanRK By Draven_\n`;
      txt += `\n`;
      txt += `🕐 *𝘏𝘰𝘳𝘢:* _${hora}_\n`;
      txt += `🌸 *𝘊𝘰𝘮𝘢𝘯𝘥𝘰𝘴:* _${totalCmds} disponibles_\n`;
      txt += `\n`;
      txt += `${SEP}\n`;
      txt += `\n`;
      txt += `🌸 *𝘊 𝘈 𝘛 𝘌 𝘎 𝘖 𝘙 Í 𝘈 𝘚* 🌸\n`;
      txt += `\n`;

      for (const { key, icon, label } of categorias) {
        txt += `${icon} *${label}* › _${CONFIG.prefix}${key}_\n`;
      }

      txt += `\n`;
      txt += `${SEP}\n`;
      txt += `\n`;
      txt += `${L1}\n`;
      txt += `> 🌸 _𝘔𝘐𝘛𝘚𝘜𝘙𝘐-𝘉𝘖𝘛 — hecho con amor_ ❤️`;

      const banner = getBanner("menu");
      return sock.sendMessage(jid,
        banner
          ? { image: { url: banner }, caption: txt }
          : { text: txt },
        { quoted: msg }
      );
    }

    // ════════════════════════════════════════
    //  CATEGORÍA ESPECÍFICA
    // ════════════════════════════════════════
    const cat = keyMap[usado];
    if (!cat) return;

    const cmds = await leerComandos(cat.carpeta);
    if (!cmds.length) return reply(sock, jid, "🌸 No se encontraron comandos en esta categoría.", msg);

    let txt = "";
    txt += `${L1}\n`;
    txt += `\n`;
    txt += `${cat.icon} *${cat.label}* ${cat.icon}\n`;
    txt += `\n`;
    txt += `${SEP}\n`;
    txt += `\n`;

    for (const cmd of cmds) {
      txt += `🌸 *${CONFIG.prefix}${cmd.name}*\n`;

      if (cmd.aliases.length > 0) {
        const al = cmd.aliases
          .filter(a => a !== cmd.name)
          .map(a => `${CONFIG.prefix}${a}`)
          .join(" · ");
        if (al) txt += `   🌺 _Alias: ${al}_\n`;
      }

      if (cmd.desc) {
        txt += `   🌷 _${cmd.desc}_\n`;
      }

      txt += "\n";
    }

    txt += `${SEP}\n`;
    txt += `\n`;
    txt += `🌸 _${cmds.length} comandos disponibles_\n`;
    txt += `🌺 _${CONFIG.prefix}menu para volver_ 💕\n`;
    txt += `\n`;
    txt += `${L1}`;

    const banner = getBanner(cat.carpeta);
    return sock.sendMessage(jid,
      banner
        ? { image: { url: banner }, caption: txt }
        : { text: txt },
      { quoted: msg }
    );
  },
};