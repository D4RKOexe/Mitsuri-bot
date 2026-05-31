import { disableWelcome, enableWelcome, isWelcomeDisabled } from "../eventos/welcomeConfig.js";

const BOT_OWNER = "573223090406@s.whatsapp.net";

function cleanJid(jid = "") {
  return String(jid).split(":")[0].trim();
}

async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    // ✅ Si es el owner del bot, siempre permitir
    if (cleanJid(userJid) === cleanJid(BOT_OWNER)) return true;

    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];
    const targetPhone = cleanJid(userJid);

    // Obtener mi LID desde las credenciales de Baileys
    const myLid = sock.authState?.creds?.me?.lid
      ? cleanJid(sock.authState.creds.me.lid)
      : null;

    // Buscar participante por número de teléfono o por LID propio
    const participant = participants.find((p) => {
      if (p?.phoneNumber && cleanJid(p.phoneNumber) === targetPhone) return true;
      if (p?.id && !p.id.includes("@lid") && cleanJid(p.id) === targetPhone) return true;
      if (myLid && cleanJid(p?.id) === myLid) return true;
      return false;
    });

    const participantByLid = myLid
      ? participants.find((p) => cleanJid(p?.id) === myLid)
      : null;

    const finalParticipant = participant || participantByLid;

    const ownerRaw = cleanJid(metadata?.owner || "");
    const isOwner =
      ownerRaw === targetPhone ||
      (myLid && ownerRaw === myLid);

    const isAdmin = Boolean(
      finalParticipant?.admin === "admin" ||
      finalParticipant?.admin === "superadmin"
    );

    console.log("=== DEBUG WELCOME TOGGLE ===");
    console.log("sender:", targetPhone);
    console.log("myLid:", myLid);
    console.log("owner grupo:", ownerRaw);
    console.log("finalParticipant:", finalParticipant);
    console.log("isOwner:", isOwner, "| isAdmin:", isAdmin);
    console.log("============================");

    return isOwner || isAdmin;
  } catch (e) {
    console.error("Error verificando admin:", e);
    return false;
  }
}

export default {
  name: "welcome",
  aliases: ["setwelcome"],
  run: async (sock, msg, args, jid, sender, isGroup) => {
    const { reply } = await import("../../utils.js");

    if (!isGroup) {
      return reply(sock, jid, "❌ Solo funciona en grupos.", msg);
    }

    const permitido = await isAdminOrOwner(sock, jid, sender);
    if (!permitido) {
      return reply(
        sock,
        jid,
        "❌ Solo admins o el owner del grupo pueden usar este comando.",
        msg
      );
    }

    const subcomando = args[0]?.toLowerCase();

    if (!subcomando || !["on", "off"].includes(subcomando)) {
      const estado = await isWelcomeDisabled(jid);
      return reply(
        sock,
        jid,
        `ℹ️ Welcome en este grupo: *${estado ? "DESACTIVADO 🔕" : "ACTIVADO 🔔"}*\n\nUso:\n*.welcome on* → activar\n*.welcome off* → desactivar`,
        msg
      );
    }

    if (subcomando === "off") {
      await disableWelcome(jid);
      return reply(
        sock,
        jid,
        "🔕 Welcome *desactivado* en este grupo.\nLos nuevos miembros no recibirán bienvenida.",
        msg
      );
    }

    if (subcomando === "on") {
      await enableWelcome(jid);
      return reply(
        sock,
        jid,
        "🔔 Welcome *activado* en este grupo.\nLos nuevos miembros recibirán bienvenida.",
        msg
      );
    }
  },
};