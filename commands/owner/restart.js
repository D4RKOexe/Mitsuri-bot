import { execSync } from "child_process";
import { reply } from "../../utils.js";

export default {
  name: "reiniciar",
  aliases: ["restart", "rst"],
  run: async (sock, msg, args, jid, isOwner) => {

    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);
    }

    await reply(sock, jid, "🔄 *Reiniciando bot...*", msg);

    try {
      execSync("pm2 restart bytebot", { stdio: "pipe" });
    } catch (e) {
      await reply(sock, jid, `❌ Error al reiniciar.\n🔎 ${e.message}`, msg);
    }
  },
};