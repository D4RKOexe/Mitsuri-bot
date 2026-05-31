import { reply } from "../../utils.js";

export default {
  name: "salirgrupo",
  aliases: ["leavegroup", "salir"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);

    const targetJid = args[0]?.trim();

    // Si no pasan JID, salir del grupo actual
    const groupJid = targetJid || jid;

    if (!groupJid?.endsWith("@g.us")) {
      return reply(sock, jid, "❌ Debes estar en un grupo o pasar el JID del grupo.\nEj: `.salirgrupo 120363xxxxxxx@g.us`", msg);
    }

    try {
      await reply(sock, jid, "👋 *Saliendo del grupo...*", msg);
      await sock.groupLeave(groupJid);
    } catch (e) {
      await reply(sock, jid, `❌ Error al salir: ${e.message}`, msg);
    }
  },
};