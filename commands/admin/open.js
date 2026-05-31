// ═══════════════════════════════════════════
//  open.js — Abrir grupo (todos pueden escribir)
// ═══════════════════════════════════════════

import { groupCmd, getReply } from "./utils.js";
import { requireAdminOrOwner, requireBotAdmin } from "./guards.js";

export const open = groupCmd("open", async (sock, msg, args, jid, sender) => {
  const reply = await getReply();
  if (!(await requireAdminOrOwner(sock, msg, jid, sender))) return;
  if (!(await requireBotAdmin(sock, msg, jid))) return;

  try {
    await sock.groupSettingUpdate(jid, "not_announcement");
    await reply(sock, jid, "✅ Grupo abierto. Todos pueden escribir.", msg);
  } catch {
    await reply(sock, jid, "❌ No puedo abrir el grupo.", msg);
  }
});

export default open;
