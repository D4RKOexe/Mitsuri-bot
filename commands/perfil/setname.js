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

export const setname = command("setname", async (sock, msg, args, jid) => {
  const reply = await getReply();

  if (!isOwner(msg)) {
    return reply(sock, jid, "❌ Solo mi creador puede cambiar mi nombre.", msg);
  }

  const nombre = args.join(" ").trim();

  if (!nombre) {
    return reply(sock, jid, "❌ Usa: .setname Safira Bot", msg);
  }

  try {
    await sock.updateProfileName(nombre);
    await reply(sock, jid, `✅ Nombre cambiado a: ${nombre}`, msg);
  } catch (e) {
    console.error("Error en setname:", e);
    await reply(sock, jid, `❌ No pude cambiar el nombre.\n\`${e.message || e}\``, msg);
  }
});

export default setname;