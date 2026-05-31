import { areJidsSameUser } from "@whiskeysockets/baileys";

export const OWNER_JID = "573223090406@s.whatsapp.net";

export function normalizeJid(jid) {
  if (!jid) return "";
  return jid.split(":")[0];
}

export function getSender(msg) {
  return (
    msg?.key?.participantAlt ||
    msg?.key?.participant ||
    msg?.key?.remoteJidAlt ||
    msg?.key?.remoteJid ||
    ""
  );
}

export function isOwner(userJid) {
  try {
    return areJidsSameUser(userJid, OWNER_JID);
  } catch {
    return normalizeJid(userJid).split("@")[0] === OWNER_JID.split("@")[0];
  }
}

export async function isGroupAdmin(sock, jid, userJid) {
  try {
    const metadata = await sock.groupMetadata(jid);

    const participant = metadata.participants.find((p) => {
      if (!p?.id) return false;

      try {
        if (areJidsSameUser(p.id, userJid)) return true;
      } catch {}

      if (p.phoneNumber && p.phoneNumber === OWNER_JID.split("@")[0] && isOwner(userJid)) {
        return true;
      }

      if (p.lid) {
        try {
          if (areJidsSameUser(p.lid, userJid)) return true;
        } catch {}
      }

      return normalizeJid(p.id).split("@")[0] === normalizeJid(userJid).split("@")[0];
    });

    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch {
    return false;
  }
}

export async function isBotAdmin(sock, jid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    const botId = sock.user?.id || "";
    const botNum = botId.split("@")[0].split(":")[0];

    console.log("=== DEBUG BOT ADMIN ===");
    console.log("BOT ID:", botId);
    console.log(
      "PARTICIPANTS:",
      metadata.participants.map((p) => ({
        id: p.id,
        lid: p.lid || null,
        phoneNumber: p.phoneNumber || null,
        admin: p.admin,
      }))
    );

    const participant = metadata.participants.find((p) => {
      const pid = (p.id || "").split("@")[0].split(":")[0];
      const plid = (p.lid || "").split("@")[0].split(":")[0];
      const ppn = (p.phoneNumber || "").replace(/\D/g, "");

      return pid === botNum || plid === botNum || ppn === botNum;
    });

    console.log("BOT MATCH:", participant);

    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch (e) {
    console.log("ERROR isBotAdmin:", e);
    return false;
  }
}
export async function requireGroup(sock, msg, jid, reply) {
  if (!jid.endsWith("@g.us")) {
    await reply(sock, jid, "❌ Este comando solo funciona en grupos.", msg);
    return false;
  }
  return true;
}

export async function requireGroupAdmin(sock, msg, jid, sender, reply) {
  if (!(await requireGroup(sock, msg, jid, reply))) return false;

  const ok = await isGroupAdmin(sock, jid, sender);
  if (!ok) {
    await reply(sock, jid, "❌ Solo los administradores pueden usar este comando.", msg);
    return false;
  }
  return true;
}

export async function requireBotAdmin(sock, msg, jid, reply) {
  const ok = await isBotAdmin(sock, jid);
  if (!ok) {
    await reply(sock, jid, "❌ Necesito ser administrador del grupo para hacer eso.", msg);
    return false;
  }
  return true;
}

export async function requireOwner(sock, sender, reply, jid, msg) {
  if (!isOwner(sender)) {
    await reply(sock, jid, "❌ Solo mi creador puede usar este comando.", msg);
    return false;
  }
  return true;
}

export async function canUseAdminCommand(sock, msg, jid, sender, reply) {
  if (isOwner(sender)) return true;
  return await requireGroupAdmin(sock, msg, jid, sender, reply);
}