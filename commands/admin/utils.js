import { permitirGrupo, quitarGrupo, grupoPermitido } from "../../utils.js";

export const OWNER_NUMBER = "573223090406";

export function normalizeJid(jid) {
  if (!jid || typeof jid !== "string") return "";
  return jid.split("@")[0].split(":")[0];
}

export function isOwner(userJid) {
  if (!userJid || typeof userJid !== "string") return false;
  return normalizeJid(userJid) === OWNER_NUMBER;
}

export async function getReply() {
  const { reply } = await import("../../utils.js");
  return reply;
}

export function getMentioned(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

export function groupCmd(name, fn, aliases = []) {
  return { name, run: fn, aliases };
}

export async function isAdminOrOwner(sock, jid, userJid) {
  if (isOwner(userJid)) return true;
  try {
    const metadata = await sock.groupMetadata(jid);
    const participant = metadata.participants.find(p =>
      normalizeJid(p.id) === normalizeJid(userJid)
    );
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    return false;
  }
}

export { permitirGrupo, quitarGrupo, grupoPermitido };