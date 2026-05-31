import { getSender } from "../../commands/utilidades/permisos.js";
import fs from "fs-extra";

const CONFIG_PATH = "./data/tools_config.json";

// ─── Cargar/guardar config ─────────────────────────────────────────────────────
async function loadConfig() {
  await fs.ensureDir("./data");
  if (!await fs.pathExists(CONFIG_PATH)) {
    await fs.writeJson(CONFIG_PATH, { disabledGroups: [] });
  }
  return fs.readJson(CONFIG_PATH);
}

async function saveConfig(config) {
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

// ─── Links ────────────────────────────────────────────────────────────────────
const TOOLS_LIST = `🛠️ *HERRAMIENTAS & APPS*
${"─".repeat(30)}

💻 *PC (GameLoop)*
https://www.mediafire.com/file/z1yvdlg772rvki4/base-2.apk/file

🖱️ *GG Mouse Pro Premium*
https://www.mediafire.com/file/6syr6534k7d4ls0/GG_LITE.igualMulador.apk/file

🐼 *Panda Mouse Pro*
https://www.mediafire.com/file/2127zy0x7knbmvx/Panda_Mouse_Pro_9.2_Crack_sem_licença.apk/file

🎣 *GG Lite VIP Anzol*
https://www.mediafire.com/file/6syr6534k7d4ls0/GG_LITE.igualMulador.apk/file

🔥 *Free Fire Amazon*
https://www.mediafire.com/file/jjzrs4ug1fehjgs/FFArmazon.apk/file

⚡ *PC Optimización + HUD*
https://www.mediafire.com/file/sliu5lzr0aoq7qe/OTIMIZAÇÃO+++HUD.rar/file

🟦 *BlueStacks PCM*
https://www.mediafire.com/file/sbqar0w901pn7uj/Bluestack_Pcm%E2%8C%A8%EF%B8%8F%F0%9F%96%B1.apk/file

${"─".repeat(30)}
 _Todos los archivos son de MediaFire._`;

export default {
  name: "tools",
  aliases: ["herramientas", "apps", "tool"],
  run: async (sock, msg, args, jid, isOwner, isAdmin) => {
    const sender = getSender(msg);
    const subCmd = args[0]?.toLowerCase();

    const config = await loadConfig();

    // ─── Subcomandos on/off (solo owner o admin) ───────────────────────────
    if (subCmd === "off" || subCmd === "on") {
      if (!isOwner && !isAdmin) {
        return sock.sendMessage(jid, {
          text: "❌ Solo admins pueden activar/desactivar este comando."
        }, { quoted: msg });
      }

      if (subCmd === "off") {
        if (!config.disabledGroups.includes(jid)) {
          config.disabledGroups.push(jid);
          await saveConfig(config);
        }
        return sock.sendMessage(jid, {
          text: "🔴 Comando *tools* desactivado en este grupo."
        }, { quoted: msg });
      }

      if (subCmd === "on") {
        config.disabledGroups = config.disabledGroups.filter(g => g !== jid);
        await saveConfig(config);
        return sock.sendMessage(jid, {
          text: "🟢 Comando *tools* activado en este grupo."
        }, { quoted: msg });
      }
    }

    // ─── Verificar si está desactivado en este grupo ───────────────────────
    if (config.disabledGroups.includes(jid)) {
      return; // silencioso, no responde nada
    }

    // ─── Enviar lista ──────────────────────────────────────────────────────
    await sock.sendMessage(jid, { text: TOOLS_LIST }, { quoted: msg });
  },
};