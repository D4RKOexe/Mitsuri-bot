import { disableWelcome, enableWelcome, isWelcomeDisabled } from "../eventos/welcomeConfig.js";

const BOT_OWNER = "573223090406@s.whatsapp.net";

function cleanJid(jid = "") {
  if (typeof jid !== "string") return String(jid || "");
  return String(jid).split(":")[0].split("@")[0].trim();
}

async function isAdminOrOwner(sock, groupJid, userJid) {
  try {
    const targetPhone = cleanJid(userJid);
    const ownerBotPhone = cleanJid(BOT_OWNER);

    // ✅ Bypass Maestro: Si el número limpio coincide con el dueño del bot, dar acceso total
    if (targetPhone === ownerBotPhone || targetPhone === "573223090406") return true;

    const metadata = await sock.groupMetadata(groupJid);
    const participants = metadata?.participants || [];

    const myLid = sock.authState?.creds?.me?.lid
      ? cleanJid(sock.authState.creds.me.lid)
      : null;

    // Buscar participante por número, ID o coincidencia de LID cruzado
    const participant = participants.find((p) => {
      const pId = cleanJid(p?.id || "");
      const pLid = cleanJid(p?.lid || "");
      const pPhone = p?.phoneNumber ? cleanJid(p.phoneNumber) : "";

      return (
        pId === targetPhone ||
        pLid === targetPhone ||
        (pPhone && pPhone === targetPhone) ||
        (myLid && pId === myLid)
      );
    });

    const participantByLid = myLid
      ? participants.find((p) => cleanJid(p?.id) === myLid || cleanJid(p?.lid) === myLid)
      : null;

    const finalParticipant = participant || participantByLid;

    const ownerRaw = cleanJid(metadata?.owner || groupJid.split("-")[0] || "");
    
    // Si tu cuenta o tu ID de LID del grupo coincide con el creador
    let isOwner = ownerRaw === targetPhone || (myLid && ownerRaw === myLid);

    // Doble verificación de seguridad para tu ID LID real en producción
    if (targetPhone === "207091226669189" || (finalParticipant?.lid && cleanJid(finalParticipant.lid) === "207091226669189")) {
      isOwner = true;
    }

    const isAdmin = Boolean(
      finalParticipant?.admin === "admin" ||
      finalParticipant?.admin === "superadmin"
    );

    console.log("=== DEBUG WELCOME TOGGLE CORREGIDO ===");
    console.log("sender verificado:", targetPhone);
    console.log("myLid:", myLid);
    console.log("owner grupo:", ownerRaw);
    console.log("isOwner:", isOwner, "| isAdmin:", isAdmin);
    console.log("=======================================");

    return isOwner || isAdmin;
  } catch (e) {
    console.error("Error verificando admin:", e);
    return false;
  }
}

export default {
  name: "welcome",
  aliases: ["setwelcome"],
  // Se acomodó el orden exacto de parámetros de tu handler (isOwner, isGroup, sender)
  run: async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const { reply } = await import("../../utils.js");

    if (!isGroup) {
      return reply(sock, jid, "❌ Solo funciona en grupos.", msg);
    }

    // Se asegura de enviar la variable string 'sender' a la validación
    const senderStr = typeof sender === "string" ? sender : String(sender || "");
    const permitido = await isAdminOrOwner(sock, jid, senderStr);
    
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