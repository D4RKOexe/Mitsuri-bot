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

export const setperfil = command("setperfil", async (sock, msg, args, jid) => {
  const reply = await getReply();

  if (!isOwner(msg)) {
    return reply(sock, jid, "❌ Solo mi creador puede cambiar mi perfil.", msg);
  }

  const text = args.join(" ").trim();

  if (!text.includes("|")) {
    return reply(
      sock,
      jid,
      "❌ Usa: .setperfil Nombre | Descripción\nEjemplo: .setperfil Safira Bot | Bot oficial de Brayan",
      msg
    );
  }

  const [nombre, descripcion] = text.split("|").map(v => v.trim());

  if (!nombre || !descripcion) {
    return reply(
      sock,
      jid,
      "❌ Debes poner nombre y descripción.\nEjemplo: .setperfil Safira Bot | Bot oficial de Brayan",
      msg
    );
  }

  try {
    await sock.updateProfileName(nombre);
    await sock.updateProfileStatus(descripcion);

    await reply(
      sock,
      jid,
      `✅ Perfil actualizado.\n\n👤 Nombre: ${nombre}\n📝 Descripción: ${descripcion}`,
      msg
    );
  } catch (e) {
    console.error("Error en setperfil:", e);
    await reply(sock, jid, `❌ No pude actualizar el perfil.\n\`${e.message || e}\``, msg);
  }
});

export default setperfil;