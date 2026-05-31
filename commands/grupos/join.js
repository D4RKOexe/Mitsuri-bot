import { groupCmd, getReply, isOwner } from "../admin/utils.js";

export const join = groupCmd("entra", async (sock, msg, args, jid, sender) => {
  const reply = await getReply();

  // Usa isOwner que ya maneja el LID correctamente
  if (!isOwner(sender)) {
    return reply(sock, jid, "❌ Solo mi creador puede usar este comando.", msg);
  }

  if (!args.length) {
    return reply(sock, jid, "❌ Envíame el link del grupo.\nEjemplo: *.entra https://chat.whatsapp.com/ABC123*", msg);
  }

  const text = args.join(" ").trim();
  const match = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);
  if (!match) {
    return reply(sock, jid, "❌ Link inválido. Usa formato: https://chat.whatsapp.com/CODIGO", msg);
  }

  const code = match[1];

  try {
    const info = await sock.groupGetInviteInfo(code);
    const groupName = info.subject || "grupo";

    await reply(sock, jid, `⏳ Intentando entrar a *${groupName}*...`, msg);

    const joined = await sock.groupAcceptInvite(code);

    await reply(sock, jid, `✅ Me uní correctamente a *${groupName}*.\n🆔 \`${joined}\``, msg);
  } catch (e) {
    console.error("[JOIN ERROR]", e);
    const errorMsg = e.message || "error desconocido";

    if (errorMsg.includes("not-authorized") || errorMsg.includes("not authorised")) {
      return reply(sock, jid, "❌ Link revocado o inválido. Pide un link nuevo.", msg);
    } else if (errorMsg.includes("too_many")) {
      return reply(sock, jid, "❌ El grupo ya tiene demasiados miembros.", msg);
    } else {
      return reply(sock, jid, `❌ No pude unirme. ${errorMsg}`, msg);
    }
  }
});

export default join;