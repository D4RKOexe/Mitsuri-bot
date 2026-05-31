// ═══════════════════════════════════════════
//  promote.js — Promover usuario a admin
// ═══════════════════════════════════════════

import { groupCmd, getReply, getMentioned } from "./utils.js";
import { requireBotAdmin } from "./guards.js";

export const promote = groupCmd(
  "promote",
  async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const reply = await getReply();

    // Solo owner del bot
    if (!isOwner) {
      return reply(sock, jid, "❌ Este comando solo puede usarlo el owner.", msg);
    }

    // Verificar si el bot es admin
    if (!(await requireBotAdmin(sock, msg, jid))) return;

    // ── Obtener usuario: por mención o por respuesta ──────────────────────
    let targets = getMentioned(msg);

    // Si no hay menciones, intentar con mensaje citado
    if (!targets.length) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const quotedSender = quoted?.participant || quoted?.remoteJid;
      if (quotedSender) {
        targets = [quotedSender];
      }
    }

    if (!targets.length) {
      return reply(
        sock, jid,
        "❌ Menciona al usuario con @ o responde su mensaje.\n📌 Ej: `.promote @usuario`",
        msg
      );
    }

    try {
      await sock.groupParticipantsUpdate(jid, targets, "promote");

      const nombres = targets.map(t => `@${t.split("@")[0]}`).join(", ");
      await sock.sendMessage(jid, {
        text: `👑 ${nombres} ${targets.length > 1 ? "han sido promovidos" : "ha sido promovido"} a admin.`,
        mentions: targets,
      }, { quoted: msg });

    } catch (e) {
      console.error("[PROMOTE ERROR]", e.message);
      await reply(sock, jid, "❌ Error al promover. ¿El bot es admin?", msg);
    }
  }
);

export default promote;