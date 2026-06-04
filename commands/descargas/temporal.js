import { reply } from "../../utils.js";
import { execSync } from "child_process";

export default {
  name: "diskinfo",

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) return;

    const disk   = execSync("df -h /").toString();
    const inodos = execSync("df -i /").toString();

    return reply(sock, jid,
      `📦 *Espacio en disco:*\n\`\`\`${disk}\`\`\`\n` +
      `📁 *Inodos:*\n\`\`\`${inodos}\`\`\``,
      msg
    );
  }
};