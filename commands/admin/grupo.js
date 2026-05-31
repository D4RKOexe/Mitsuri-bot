import { groupCmd, getReply, isOwner, permitirGrupo, quitarGrupo } from "./utils.js";
import { getSender } from "../utilidades/permisos.js";

export default groupCmd("grupo", async (sock, msg, args, jid) => {
  const reply = await getReply();
  const sender = getSender(msg); // ← extraer del msg directamente

  if (!isOwner(sender)) {
    return reply(sock, jid, "❌ Solo el owner puede usar este comando.", msg);
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "on") {
    await permitirGrupo(jid);
    return reply(sock, jid, "✅ Bot activado en este grupo.", msg);
  }

  if (sub === "off") {
    await quitarGrupo(jid);
    return reply(sock, jid, "🔴 Bot desactivado en este grupo.", msg);
  }

  return reply(sock, jid, "📌 Uso:\n*.grupo on* — activar bot aquí\n*.grupo off* — desactivar bot aquí", msg);
});