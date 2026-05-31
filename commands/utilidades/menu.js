import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Emoji por categoría ──────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  admin:       "🛡️",
  descargas:   "⬇️",
  diversión:   "🎉",
  diversion:   "🎉",
  eventos:     "📅",
  grupos:      "👥",
  ia:          "🤖",
  juegos:      "🎮",
  media:       "🎵",
  owner:       "👑",
  utilidades:  "🔧",
  stickers:    "🖼️",
  info:        "ℹ️",
  menu:        "📋",
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name.toLowerCase()] || "✨";
}

export default {
  name: "menu",
  aliases: ["help", "comandos"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const p = CONFIG.prefix;
    const commandsDir = path.join(__dirname, '../../commands');

    const now = new Date();
    const hora = now.getHours();
    const saludo =
      hora >= 5  && hora < 12 ? "🌅 ¡Buenos días!" :
      hora >= 12 && hora < 18 ? "☀️ ¡Buenas tardes!" :
                                "🌙 ¡Buenas noches!";

    // ─── Header ───────────────────────────────────────────────────────────────
    let menu = ``;
    menu += `╔═══════════════════════╗\n`;
    menu += `║  ⚡ *${CONFIG.botName}* ⚡  \n`;
    menu += `╚═══════════════════════╝\n\n`;
    menu += `${saludo}\n`;
    menu += `🔑 *Prefijo:* \`${p}\`\n`;
    menu += `${"▰".repeat(22)}\n\n`;

    const categories = fs.readdirSync(commandsDir).sort();
    let totalCmds = 0;

    for (const category of categories) {
      const categoryPath = path.join(commandsDir, category);
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
      if (files.length === 0) continue;

      const cmds = [];

      for (const file of files) {
        try {
          const filePath = path.join(categoryPath, file);
          const cmdModule = await import(`file://${filePath}?u=${Date.now()}`);
          const cmd = cmdModule.default;
          if (cmd?.name) cmds.push(cmd);
        } catch {
          continue;
        }
      }

      if (cmds.length === 0) continue;

      const icon = getCategoryIcon(category);
      menu += `┌─「 ${icon} *${category.toUpperCase()}* 」\n`;

      for (const cmd of cmds) {
        totalCmds++;
        const aliases = cmd.aliases?.length
          ? ` ┄ _${cmd.aliases.slice(0, 3).join(" • ")}_`
          : "";
        menu += `│  ◈ ${p}${cmd.name}${aliases}\n`;
      }

      menu += `└${"─".repeat(22)}\n\n`;
    }

    // ─── Footer ───────────────────────────────────────────────────────────────
    menu += `${"▰".repeat(22)}\n`;
    menu += `📊 *${totalCmds} comandos* disponibles\n`;
    menu += `${"▰".repeat(22)}\n\n`;
    menu += `╔══════════════════════╗\n`;
    menu += `║  💡 Escribe el comando  ║\n`;
    menu += `║  para más información  ║\n`;
    menu += `╚══════════════════════╝`;

    await reply(sock, jid, menu, msg);
  }
};