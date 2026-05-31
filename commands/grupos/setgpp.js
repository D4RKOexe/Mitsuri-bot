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

function normalizeJid(jid) {
  if (!jid || typeof jid !== "string") return "";
  return jid.split("@")[0].split(":")[0];
}

function isOwner(msg) {
  const sender = getSenderId(msg);
  return normalizeJid(sender) === normalizeJid(OWNER_PN);
}

async function isUserAdminOrOwner(sock, jid, userJid) {
  if (normalizeJid(userJid) === normalizeJid(OWNER_PN)) return true;

  try {
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(
      (p) => normalizeJid(p.id) === normalizeJid(userJid)
    );

    return !!participant && (
      participant.admin === "admin" ||
      participant.admin === "superadmin"
    );
  } catch (e) {
    console.log("ERROR isUserAdminOrOwner:", e);
    return false;
  }
}

async function isBotAdmin(sock, jid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    const botNumber = normalizeJid(sock.user?.id);

    return metadata.participants.some((p) => {
      const pid = normalizeJid(p.id);
      const ppn = (p.phoneNumber || "").replace(/\D/g, "");
      const plid = normalizeJid(p.lid || "");
      const isSame = pid === botNumber || ppn === botNumber || plid === botNumber;
      return isSame && (p.admin === "admin" || p.admin === "superadmin");
    });
  } catch (e) {
    console.log("ERROR isBotAdmin:", e);
    return false;
  }
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

export const setgpp = command("setgpp", async (sock, msg, args, jid, sender) => {
  const reply = await getReply();

  if (!jid.endsWith("@g.us")) {
    return reply(sock, jid, "❌ Este comando solo funciona en grupos.", msg);
  }

  // FIX: obtener el sender de forma segura
  const senderJid = (typeof sender === "string" && sender) ? sender : getSenderId(msg);

  const allowed = await isUserAdminOrOwner(sock, jid, senderJid);
  if (!allowed) {
    return reply(sock, jid, "❌ Solo los administradores y mi creador pueden cambiar la foto del grupo.", msg);
  }

  const botAdmin = await isBotAdmin(sock, jid);
  if (!botAdmin) {
    return reply(sock, jid, "❌ Necesito ser administrador para cambiar la foto del grupo.", msg);
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
      "❌ Envía una imagen con el comando o responde a una imagen con *.setgpp*.",
      msg
    );
  }

  let tempPath = null;

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

    tempPath = path.join(process.cwd(), `setgpp-${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);

    await sock.updateProfilePicture(jid, { url: tempPath });

    await reply(sock, jid, "✅ Foto del grupo actualizada correctamente.", msg);
  } catch (e) {
    console.error("Error en setgpp:", e);
    await reply(sock, jid, `❌ No pude cambiar la foto del grupo.\n\`${e.message || e}\``, msg);
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});

export default setgpp;