// ─── Auto-promote del owner al entrar a grupos ────────────────────────────────

import { areJidsSameUser } from "@whiskeysockets/baileys";

const OWNER_JID = "573223090406@s.whatsapp.net";
const OWNER_NUM = "573223090406";

function isOwnerJid(jid) {
  if (!jid) return false;
  try {
    if (areJidsSameUser(jid, OWNER_JID)) return true;
  } catch {}
  // Fallback por número puro (cubre LIDs y variantes)
  const num = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return num === OWNER_NUM;
}

async function isBotAdmin(sock, groupJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const botNum = (sock.user?.id || "").split("@")[0].split(":")[0];

    const bot = metadata.participants.find((p) => {
      const pid = (p.id || "").split("@")[0].split(":")[0];
      const ppn = (p.phoneNumber || "").replace(/\D/g, "");
      return pid === botNum || ppn === botNum;
    });

    return bot?.admin === "admin" || bot?.admin === "superadmin";
  } catch {
    return false;
  }
}

async function promoteOwner(sock, groupJid, jidUser, reason) {
  // Verificar que el bot es admin antes de intentar
  const botEsAdmin = await isBotAdmin(sock, groupJid);
  if (!botEsAdmin) {
    console.log(`⚠️ No puedo promover en ${groupJid}: el bot no es admin`);
    return;
  }

  try {
    // Buscar el JID real del owner dentro del grupo (puede estar como LID)
    const metadata = await sock.groupMetadata(groupJid);
    const ownerParticipant = metadata.participants.find((p) => {
      const pid = (p.id || "").split("@")[0].split(":")[0];
      const ppn = (p.phoneNumber || "").replace(/\D/g, "");
      return pid === OWNER_NUM || ppn === OWNER_NUM;
    });

    const targetJid = ownerParticipant?.id || jidUser;

    await sock.groupParticipantsUpdate(groupJid, [targetJid], "promote");
    console.log(`✅ [${reason}] Owner promovido en ${groupJid} como ${targetJid}`);
  } catch (e) {
    console.log(`❌ Auto-promote falló (${reason}):`, e.message);
  }
}

export function setupAutoPromote(sock) {
  sock.ev.on("group-participants.update", async (update) => {
    const { id: groupJid, participants, action } = update;

    console.log(`📦 [AutoPromote] Evento: ${action} en ${groupJid}`);
    console.log(`👥 Participantes:`, participants);

    for (const participant of participants) {
      const jidUser = typeof participant === "string" ? participant : participant?.id;
      if (!jidUser) continue;

      const esOwner = isOwnerJid(jidUser);
      console.log(`👤 ${jidUser} | esOwner: ${esOwner} | action: ${action}`);

      if (!esOwner) continue;

      // Owner entra al grupo → promover
      if (action === "add") {
        await promoteOwner(sock, groupJid, jidUser, "add");
      }

      // Le quitaron admin al owner → restaurar
      if (action === "demote") {
        await promoteOwner(sock, groupJid, jidUser, "demote");
      }
    }
  });
}