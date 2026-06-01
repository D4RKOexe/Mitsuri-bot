import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "all",

  async run(sock, msg, args, jid) {
    const { reply } = await import("../../utils.js");

    const commandsDir = path.join(__dirname, "../../commands");

    let texto = `╭──〔 TODOS LOS COMANDOS 〕──⬣\n\n`;

    const categorias = fs.readdirSync(commandsDir);

    for (const categoria of categorias) {

      const ruta = path.join(commandsDir, categoria);

      if (!fs.statSync(ruta).isDirectory()) continue;

      texto += `【 ${categoria.toUpperCase()} 】\n`;

      const files = fs.readdirSync(ruta).filter(f => f.endsWith(".js"));

      for (const file of files) {
        try {
          const mod = await import(`file://${path.join(ruta, file)}?u=${Date.now()}`);

          if (mod.default?.name) {
            texto += `◈ ${CONFIG.prefix}${mod.default.name}\n`;
          }
        } catch {}
      }

      texto += `\n`;
    }

    texto += `╰──────────────⬣`;

    return reply(sock, jid, texto, msg);
  }
};