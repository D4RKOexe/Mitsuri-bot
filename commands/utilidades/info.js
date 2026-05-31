import { CONFIG } from "../../config.js";

export default {
  name: "info",
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    await reply(sock, jid, `╭━━━━━━━━━━━━╮
┃ ℹ️ *INFO DEL BOT*
╰━━━━━━━━━━━━╯
🤖 *Nombre:* ${CONFIG.botName}
📝 *Descripción:* Hola mi nombre es ${CONFIG.botName}.
📌 *Prefijo:* ${CONFIG.prefix}
👑 *Owner:* Draven
⚡ *Runtime:* Node.js ${process.version}
📅 *Fecha:* ${new Date().toLocaleString("es-CO")}
━━━━━━━━━━━━━━━
💡 Escribe *.menu* para ver los comandos`, msg);
  }
};
