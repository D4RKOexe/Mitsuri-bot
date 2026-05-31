import { reply } from "../../utils.js";

export default {
  name: "broadcast",
  aliases: ["bc", "anuncio"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);

    const texto = args.join(" ").trim();
    if (!texto) {
      return reply(sock, jid, "❌ Escribe el mensaje a enviar.\nEj: `.broadcast Hola a todos!`", msg);
    }

    try {
      await reply(sock, jid, "⏳ *Enviando broadcast...*", msg);

      const chats   = await sock.groupFetchAllParticipating();
      const grupos  = Object.values(chats);
      let enviados  = 0;
      let fallidos  = 0;

      for (const grupo of grupos) {
        try {
          await sock.sendMessage(grupo.id, {
            text: `📢 *Mensaje del Owner*\n${"─".repeat(25)}\n${texto}`,
          });
          enviados++;
          await new Promise(r => setTimeout(r, 1000)); // delay anti-ban
        } catch {
          fallidos++;
        }
      }

      await reply(sock, jid,
        `╭━━━〔 📢 BROADCAST 〕━━━⬣\n` +
        `┃ ✅ *Enviados:* ${enviados}\n` +
        `┃ ❌ *Fallidos:* ${fallidos}\n` +
        `┃ 📊 *Total:* ${grupos.length}\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
        msg
      );
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};