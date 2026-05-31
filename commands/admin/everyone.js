// ═══════════════════════════════════════════
//  everyone.js — Mencionar a todos en el grupo
// ═══════════════════════════════════════════

import { groupCmd, getReply } from "./utils.js";
import { requireAdminOrOwner } from "./guards.js";

export const everyone = groupCmd(
  "everyone",
  async (sock, msg, args, jid, sender) => {
    const reply = await getReply();
    if (!(await requireAdminOrOwner(sock, msg, jid, sender))) return;

    try {
      const group = await sock.groupMetadata(jid);
      const participants = group.participants.map((p) => p.id);
      const text = args.join(" ") || "📢 Atención todos!";
      await sock.sendMessage(jid, { text, mentions: participants }, { quoted: msg });
    } catch {
      await reply(sock, jid, "❌ Error al mencionar a todos.", msg);
    }
  }
);

export default everyone;
