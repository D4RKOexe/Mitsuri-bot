import { normalizeJid, isOwner, getReply } from "./utils.js";
import { getSender } from "../utilidades/permisos.js";

export async function isBotAdmin(sock, jid) {
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

export async function requireGroup(sock, msg, jid) {
  const reply = await getReply();
  if (!jid.endsWith("@g.us")) {
    await reply(sock, jid, "❌ Este comando solo funciona en grupos.", msg);
    return false;
  }
  return true;
}

export async function requireAdminOrOwner(sock, msg, jid, senderParam) {
  const reply = await getReply();
  if (!(await requireGroup(sock, msg, jid))) return false;

  // Obtener sender del msg si el parámetro no es un string JID válido
  const sender = typeof senderParam === "string" && senderParam.includes("@")
    ? senderParam
    : getSender(msg);

  if (isOwner(sender)) return true;

  try {
    const metadata = await sock.groupMetadata(jid);
    const senderLid = msg.key?.participant || msg.key?.remoteJid;

    const participant = metadata.participants.find(p => {
      const pid = normalizeJid(p.id);
      const senderNorm = normalizeJid(sender);
      const senderLidNorm = normalizeJid(senderLid);
      return pid === senderNorm || pid === senderLidNorm;
    });

    const esAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";
    if (esAdmin) return true;
  } catch (e) {
    console.log("[ADMIN CHECK ERROR]", e.message);
  }

  await reply(sock, jid, "❌ Solo admins pueden usar este comando.", msg);
  return false;
}

export async function requireBotAdmin(sock, msg, jid) {
  const reply = await getReply();
  const ok = await isBotAdmin(sock, jid);
  if (!ok) {
    await reply(sock, jid, "❌ Necesito ser administrador del grupo para hacer eso.", msg);
    return false;
  }
  return true;
}