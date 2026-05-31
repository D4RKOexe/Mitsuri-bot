// ═══════════════════════════════════════════
//  close.js — Cerrar grupo (solo admins escriben)
// ═══════════════════════════════════════════

import { groupCmd, getReply } from "./utils.js";
import { requireAdminOrOwner, requireBotAdmin } from "./guards.js";

export const close = groupCmd(
  "close",
  async (sock, msg, args, jid, sender) => {
    const reply = await getReply();
    if (!(await requireAdminOrOwner(sock, msg, jid, sender))) return;
    if (!(await requireBotAdmin(sock, msg, jid))) return;

    try {
      await sock.groupSettingUpdate(jid, "announcement");
      await reply(
        sock,
        jid,
        "🔒 Grupo cerrado. Solo admins pueden escribir.",
        msg
      );
    } catch {
      await reply(sock, jid, "❌ No puedo cerrar el grupo.", msg);
    }
  }
);

export default close;
