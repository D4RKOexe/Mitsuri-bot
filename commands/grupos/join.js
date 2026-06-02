import { reply } from "../../utils.js";

export default {
  name: "join",
  aliases: ["entrar"],

  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);
    }

    const link = args[0];

    if (!link) {
      return reply(
        sock,
        jid,
        "❌ Uso:\n.join https://chat.whatsapp.com/XXXXXXXXXXXX",
        msg
      );
    }

    const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);

    if (!match) {
      return reply(sock, jid, "❌ Link de grupo inválido.", msg);
    }

    try {
      const inviteCode = match[1];

      await sock.groupAcceptInvite(inviteCode);

      await reply(
        sock,
        jid,
        "✅ Me uní al grupo correctamente.",
        msg
      );

    } catch (e) {
      await reply(
        sock,
        jid,
        `❌ Error al entrar al grupo.\n\n${e.message}`,
        msg
      );
    }
  },
};