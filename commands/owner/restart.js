import { reply } from "../../utils.js";

export default {
  name: "reiniciar",
  aliases: ["restart", "rst"],

  async run(sock, msg, args, jid, isOwner) {

    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);
    }

    await reply(
      sock,
      jid,
      "🔄 Reiniciando bot...",
      msg
    );

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
};