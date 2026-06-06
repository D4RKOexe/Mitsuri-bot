// ═══════════════════════════════════════════
//  kick.js — Expulsar usuario del grupo
// ═══════════════════════════════════════════

import { groupCmd, getReply, getMentioned } from "./utils.js";
import { requireAdminOrOwner, requireBotAdmin } from "./guards.js";

// 👑 Número del owner
const OWNER_NUMBER = "573223090406";

// 🤖 Número del bot
const BOT_NUMBER = "573222842090";

// ─── Registro de uso por admin ────────────────────────────────────────────────
const kickRegistry = new Map();

const KICK_LIMIT_MS     = 60_000;
const MAX_KICKS_PER_MIN = 1;

function isOwner(sender) {
  const str = typeof sender === "string" ? sender : (sender?.toString?.() || "");
  const num = str.split("@")[0].split(":")[0].replace(/\D/g, "");
  return num === OWNER_NUMBER;
}

async function demoteAdmin(sock, jid, sender) {
  try {
    const senderJid = typeof sender === "string" ? sender : String(sender);
    await sock.groupParticipantsUpdate(jid, [senderJid], "demote");
    console.log(`⚠️ Admin ${senderJid} degradado por abuso.`);
  } catch (e) {
    console.log("Error al degradar:", e.message);
  }
}

function checkKickAbuse(sender) {
  const now = Date.now();
  const record = kickRegistry.get(sender) || { lastKick: 0, count: 0 };
  if (now - record.lastKick > KICK_LIMIT_MS) {
    record.count = 0;
  }
  return record;
}

export const kick = groupCmd(
  "kick",
  async (sock, msg, args, jid, sender) => {

    const reply = await getReply();

    if (!(await requireAdminOrOwner(sock, msg, jid, sender))) return;
    if (!(await requireBotAdmin(sock, msg, jid))) return;

    // ─── Obtener mencionados (por @ o por respuesta) ───────────────────────
    const mentioned = getMentioned(msg);

    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (!mentioned.length && quotedParticipant) {
      mentioned.push(quotedParticipant);
    }

    if (!mentioned.length) {
      return reply(sock, jid, "❌ Menciona al gey con @ o responde su mensaje.", msg);
    }

    const ownerUsing = isOwner(sender);

    // ─── Filtros solo para admins (no owner) ──────────────────────────────
    if (!ownerUsing) {

      if (mentioned.length > MAX_KICKS_PER_MIN) {
        await reply(
          sock, jid,
          `❌ Solo puedes expulsar a *1 persona a la vez*.\n⚠️ Por abuso, serás removido como administrador.`,
          msg
        );
        await demoteAdmin(sock, jid, sender);
        kickRegistry.delete(sender);
        return;
      }

      const record = checkKickAbuse(sender);
      if (record.count >= MAX_KICKS_PER_MIN) {
        const segsRestantes = Math.ceil(
          (KICK_LIMIT_MS - (Date.now() - record.lastKick)) / 1000
        );
        await reply(
          sock, jid,
          `⏳ Solo puedes expulsar *1 persona por minuto*.\nEspera *${segsRestantes}s* antes de volver a usar el comando.\n⚠️ Si sigues intentando, perderás el admin por gey.`,
          msg
        );

        record.reincidencia = (record.reincidencia || 0) + 1;
        kickRegistry.set(sender, record);

        if (record.reincidencia >= 2) {
          await reply(
            sock, jid,
            `🚫 Reincidencia detectada. Se te ha removido el admin por gey.`,
            msg
          );
          await demoteAdmin(sock, jid, sender);
          kickRegistry.delete(sender);
        }
        return;
      }
    }

    // ─── Validar mencionados ───────────────────────────────────────────────
    const metadata = await sock.groupMetadata(jid);

    for (const user of mentioned) {
      const participant = metadata.participants.find(p => p.id === user);
      if (!participant) continue;

      const phone = (participant.phoneNumber || participant.id)
        .replace("@s.whatsapp.net", "")
        .replace(/\D/g, "");

      if (phone === BOT_NUMBER) {
        return reply(sock, jid, "❌ No me puedo expulsar yo misma gey.", msg);
      }

      if (phone === OWNER_NUMBER) {
        return reply(sock, jid, "❌ No puedes expulsar al jefe.", msg);
      }
    }

    // ─── Ejecutar kick ─────────────────────────────────────────────────────
    try {
      await sock.groupParticipantsUpdate(jid, mentioned, "remove");
      await reply(sock, jid, "✅ Usuario expulsado.", msg);

      if (!ownerUsing) {
        kickRegistry.set(sender, {
          lastKick: Date.now(),
          count: 1,
          reincidencia: 0,
        });
      }

    } catch (e) {
      console.log(e);
      await reply(sock, jid, "❌ No pude expulsar al usuario.", msg);
    }
  }
);

export default kick;