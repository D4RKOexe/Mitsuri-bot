import { reply } from "../../utils.js";

export default {
  name: "fwdid",
  aliases: ["forwardid", "fwd"],

  run: async (sock, msg, args, jid, sender) => {
    if (!args[0]) {
      return reply(
        sock,
        jid,
        "❌ Uso: .fwdid <ID>\nEj: .fwdid 3EB0EA707B78AEB4A5FAB4D2D3EBCB3D",
        msg
      );
    }

    const stanzaId = args[0];

    // Debug: ver qué hay en el store
    console.log("🔍 fwdid buscando:", stanzaId);
    console.log("🔍 msgStore size:", sock.msgStore?.size ?? "NO EXISTE");
    console.log("🔍 Keys disponibles:", [...(sock.msgStore?.keys() ?? [])].slice(-5));

    if (!sock.msgStore?.has(stanzaId)) {
      return reply(
        sock,
        jid,
        `❌ ID *${stanzaId}* no encontrado.\n\n💡 Revisa los logs con:\n\`pm2 logs bytebot\`\n\nCopia el 🆔 ID del mensaje.\n\n⏰ Solo guarda los últimos 100 mensajes por reinicio.`,
        msg
      );
    }

    try {
      const targetMsg = sock.msgStore.get(stanzaId);
      const ownerJid = "573223090406@s.whatsapp.net";

      await sock.sendMessage(ownerJid, { forward: targetMsg, force: true });
      await reply(sock, jid, `✅ Reenviado a tu WhatsApp!\n🆔 ${stanzaId}`, msg);
    } catch (e) {
      console.error("fwdid error:", e);
      await reply(sock, jid, `❌ Error al reenviar: ${e.message}`, msg);
    }
  },
};