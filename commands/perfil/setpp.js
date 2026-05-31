import fs from "fs";
import path from "path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

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

function getQuotedImageMessage(msg, jid) {
  const quoted = msg?.message?.extendedTextMessage?.contextInfo;
  const qMsg = quoted?.quotedMessage;

  if (!qMsg?.imageMessage) return null;

  return {
    key: {
      remoteJid: jid,
      id: quoted?.stanzaId,
      participant: quoted?.participant,
    },
    message: {
      imageMessage: qMsg.imageMessage,
    },
  };
}

function hasDirectImage(msg) {
  return !!msg?.message?.imageMessage;
}

export const setpp = command("setpp", async (sock, msg, args, jid) => {
  const reply = await getReply();

  if (!isOwner(msg)) {
    return reply(sock, jid, "❌ Solo mi creador puede cambiar mi foto de perfil.", msg);
  }

  let mediaMsg = null;

  if (hasDirectImage(msg)) {
    mediaMsg = msg;
  } else {
    mediaMsg = getQuotedImageMessage(msg, jid);
  }

  if (!mediaMsg) {
    return reply(
      sock,
      jid,
      "❌ Envía una imagen con el comando o responde a una imagen con *.setpp*.",
      msg
    );
  }

  try {
    const buffer = await downloadMediaMessage(
      mediaMsg,
      "buffer",
      {},
      {
        logger: sock.logger,
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    if (!buffer || !buffer.length) {
      return reply(sock, jid, "❌ No pude descargar la imagen.", msg);
    }

    const tempPath = path.join(process.cwd(), `setpp-${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);

    await sock.updateProfilePicture(sock.user.id, { url: tempPath });

    fs.unlinkSync(tempPath);

    await reply(sock, jid, "✅ Foto de perfil actualizada correctamente.", msg);
  } catch (e) {
    console.error("Error en setpp:", e);
    await reply(sock, jid, `❌ No pude cambiar la foto de perfil.\n\`${e.message || e}\``, msg);
  }
});

export default setpp;