// ═══════════════════════════════════════════
//  demote.js — Remover admin de usuario
// ═══════════════════════════════════════════

import { groupCmd, getReply, getMentioned } from "./utils.js";
import { requireAdminOrOwner, requireBotAdmin } from "./guards.js";

export const demote = groupCmd(
  "demote",
  async (sock, msg, args, jid, isOwner, isGroup, sender) => {
    const reply = await getReply();
    if (!(await requireAdminOrOwner(sock, msg, jid, sender))) return;
    if (!(await requireBotAdmin(sock, msg, jid))) return;

    // ── Obtener usuario: por mención o por respuesta ──────────────────────
    let targets = getMentioned(msg);

    if (!targets.length) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const quotedSender = quoted?.participant || quoted?.remoteJid;
      if (quotedSender) targets = [quotedSender];
    }

    if (!targets.length) {
      return reply(
        sock, jid,
        "❌ Menciona al usuario con @ o responde su mensaje.\n📌 Ej: `.demote @usuario`",
        msg
      );
    }

    try {
      await sock.groupParticipantsUpdate(jid, targets, "demote");

      const nombres = targets.map(t => `@${t.split("@")[0]}`).join(", ");
      await sock.sendMessage(jid, {
        text: `⬇️ ${nombres} ${targets.length > 1 ? "han sido removidos" : "ha sido removido"} como admin.`,
        mentions: targets,
      }, { quoted: msg });

    } catch (e) {
      console.error("[DEMOTE ERROR]", e.message);
      await reply(sock, jid, "❌ Error al remover admin. ¿El bot es admin?", msg);
    }
  }
);

export default demote;