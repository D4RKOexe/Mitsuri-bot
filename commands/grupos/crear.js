async function getReply() {
  const { reply } = await import("../../utils.js");
  return reply;
}

const command = (name, fn, aliases = []) => ({
  name,
  run: fn,
  aliases,
});

const OWNER_PN = "573223090406@s.whatsapp.net"; // tu número completo

function getSenderId(msg) {
  return (
    msg?.key?.participantAlt ||
    msg?.key?.participant ||
    msg?.key?.remoteJidAlt ||
    msg?.key?.remoteJid ||
    ""
  );
}

function isOwner(msg) {
  const sender = getSenderId(msg);
  const senderUser = sender.split("@")[0];
  const ownerUser = OWNER_PN.split("@")[0];
  return sender === OWNER_PN || senderUser === ownerUser;
}

export const crear = command("crear", async (sock, msg, args, jid, sender) => {
  const reply = await getReply();

  if (!isOwner(msg)) {
    return reply(sock, jid, "❌ Solo mi creador puede crear grupos.", msg);
  }

  if (!args.length) {
    return reply(
      sock,
      jid,
      "❌ Usa: `.crear Nombre del Grupo`\nEjemplo: `.crear Draven Hack Grupo Descarga`",
      msg
    );
  }

  const nombre = args.join(" ").trim();

  try {
    await reply(sock, jid, `⏳ Creando grupo *${nombre}*...`, msg);

    const group = await sock.groupCreate(nombre, [OWNER_PN]);
    const groupId = group.id;

    // Promover a ti (owner) como admin poco después
    try {
      await sock.groupParticipantsUpdate(groupId, [OWNER_PN], "promote");
      console.log(`✅ ${OWNER_PN} promovido a admin en el grupo ${groupId}`);
    } catch (e) {
      console.log(`⚠️  No se pudo promover al owner:`, e.message);
    }

    const metadata = await sock.groupMetadata(groupId);
    const inviteCode = await sock.groupInviteCode(groupId);

    const me = metadata.participants.find(p => p.id === OWNER_PN);

    await reply(
      sock,
      jid,
      `✅ Grupo creado exitosamente!\n\n` +
      `📛 *${metadata.subject}*\n` +
      `🆔 \`${groupId}\`\n` +
      `👥 Miembros: ${metadata.participants.length}\n` +
      `👑 Bot: admin (creador)\n` +
      `👑 Owner: ${me?.admin ? "✅ admin" : "❌ no admin (promoción fallida)"}\n\n` +
      `🔗 Código de invitación:\n\`${inviteCode}\``,
      msg
    );

    await sock.sendMessage(groupId, {
      text:
        `🎉 ¡Grupo *${metadata.subject}* creado!\n\n` +
        `Este bot ya es administrador.\n` +
        `Tu número fue promovido como admin automáticamente.\n` +
        `Para otros comandos, escribe *.menu*.\n\n` +
        `⚠️ Recuerda: solo los admins y el owner pueden usar comandos como .kick, .promote, etc.`
    });
  } catch (e) {
    console.error("Error crear grupo:", e);
    const errorMsg = e.message || "error desconocido";

    if (errorMsg.includes("too_many")) {
      await reply(sock, jid, "❌ Error: tienes demasiados grupos.", msg);
    } else if (errorMsg.includes("participants")) {
      await reply(sock, jid, "❌ Error: necesito al menos 1 participante válido.", msg);
    } else {
      await reply(sock, jid, `❌ No pude crear el grupo.\n\`${errorMsg}\``, msg);
    }
  }
});

export default crear;