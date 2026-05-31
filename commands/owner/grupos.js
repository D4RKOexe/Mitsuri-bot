import { reply } from "../../utils.js";

export default {
  name: "grupos",
  aliases: ["listgroups", "misgrupos"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);

    try {
      await reply(sock, jid, "⏳ *Obteniendo grupos...*", msg);

      const chats = await sock.groupFetchAllParticipating();
      const grupos = Object.values(chats);

      if (!grupos.length) {
        return reply(sock, jid, "❌ El bot no está en ningún grupo.", msg);
      }

      const lista = grupos
        .map((g, i) => `┃ *${i + 1}.* ${g.subject}\n┃     👥 ${g.participants.length} miembros\n┃     🆔 ${g.id}`)
        .join("\n┃\n");

      await reply(sock, jid,
        `╭━━━〔 👥 GRUPOS DEL BOT 〕━━━⬣\n┃\n` +
        `${lista}\n┃\n` +
        `┃ 📊 *Total: ${grupos.length} grupos*\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
        msg
      );
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};