async function getReply() {
  const { reply } = await import("../../utils.js");
  return reply;
}

const command = (name, fn, aliases = []) => ({
  name,
  run: fn,
  aliases,
});

const OWNER_PN = "573223090406@s.whatsapp.net";

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

export const setbio = command("setbio", async (sock, msg, args, jid) => {
  const reply = await getReply();

  if (!isOwner(msg)) {
    return reply(sock, jid, "❌ Solo mi creador puede cambiar mi descripción.", msg);
  }

  const bio = args.join(" ").trim();

  if (!bio) {
    return reply(sock, jid, "❌ Usa: .setbio Bot oficial de Brayan", msg);
  }

  try {
    await sock.updateProfileStatus(bio);
    await reply(sock, jid, `✅ Descripción cambiada a:\n${bio}`, msg);
  } catch (e) {
    console.error("Error en setbio:", e);
    await reply(sock, jid, `❌ No pude cambiar la descripción.\n\`${e.message || e}\``, msg);
  }
});

export default setbio;