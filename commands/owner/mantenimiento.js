import { reply } from "../../utils.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const STATE_FILE = "./data/mantenimiento.json";

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf8")).mantenimiento ?? false;
    }
  } catch {}
  return false;
}

function saveState(value) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ mantenimiento: value }, null, 2));
  } catch {}
}

export const estado = { mantenimiento: loadState() };

export default {
  name: "mantenimiento",
  aliases: ["maintenance", "modo"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);

    estado.mantenimiento = !estado.mantenimiento;
    saveState(estado.mantenimiento);

    const activo = estado.mantenimiento;
    await reply(sock, jid,
      `╭━━━〔 🔧 MANTENIMIENTO 〕━━━⬣\n` +
      `┃ Estado: *${activo ? "activado 🔴" : "desactivado 🟢"}*\n` +
      (activo ? `┃ ⚠️ El bot no responderá a nadie.\n` : `┃ ✅ El bot responde normalmente.\n`) +
      `╰━━━━━━━━━━━━━━━━⬣`,
      msg
    );
  },
};