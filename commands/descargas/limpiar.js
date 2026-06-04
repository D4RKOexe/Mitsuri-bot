import { reply } from "../../utils.js";
import { execSync } from "child_process";

export default {
  name: "limpiar",

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) return;

    const antes = execSync("df -h /").toString();

    // Limpiar temporales comunes
    try { execSync("rm -rf /tmp/*"); } catch {}
    try { execSync("rm -rf /var/log/*.gz /var/log/*.1"); } catch {}
    try { execSync("apt-get clean -y"); } catch {}
    try { execSync("journalctl --vacuum-size=50M"); } catch {}

    const despues = execSync("df -h /").toString();

    return reply(sock, jid,
      `🧹 *Limpieza lista*\n\n` +
      `*Antes:*\n\`\`\`${antes}\`\`\`\n` +
      `*Después:*\n\`\`\`${despues}\`\`\``,
      msg
    );
  }
};