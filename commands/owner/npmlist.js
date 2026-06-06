import { execSync } from "child_process";
import { reply } from "../../utils.js";

export default {
  name: "npmlist",
  aliases: ["paquetes", "modules"],

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) return reply(sock, jid, "❌ Solo el owner.", msg);

    try {
      const lista = execSync("npm list --depth=0", {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15000,
      }).trim();

      return reply(sock, jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      📦 PAQUETES INSTALADOS

${lista.slice(0, 3000)}

┗━━━°❀•°:🌸:°•❀°━━━┛`, msg);

    } catch (e) {
      return reply(sock, jid, `❌ Error: ${e.message.slice(0, 300)}`, msg);
    }
  }
};