import axios from "axios";
import { reply } from "../../utils.js";

export default {
  name: "checkhost",
  aliases: ["ping", "isup", "online"],
  description: "Verifica si un host está online",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const host = args[0]?.trim().replace(/https?:\/\//i, "").split("/")[0];
    if (!host) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe un host o dominio.\nEj: `.checkhost google.com`", msg);
    }

    await react("⏳");
    await reply(sock, jid, `🔍 Verificando *${host}*...`, msg);

    try {
      const inicio = Date.now();
      const { data } = await axios.get(
        `https://check-host.net/check-http?host=${host}&max_nodes=3`,
        {
          timeout: 15000,
          headers: { Accept: "application/json" }
        }
      );

      const ms = Date.now() - inicio;
      const requestId = data?.request_id;

      if (!requestId) throw new Error("No se pudo verificar el host.");

      // Esperar resultado
      await new Promise(r => setTimeout(r, 4000));

      const { data: result } = await axios.get(
        `https://check-host.net/check-result/${requestId}`,
        { timeout: 10000, headers: { Accept: "application/json" } }
      );

      let online = 0, offline = 0;
      for (const node of Object.values(result || {})) {
        if (!node) { offline++; continue; }
        const status = node?.[0]?.[0];
        status === 1 ? online++ : offline++;
      }

      const total = online + offline;
      const estado = online > 0 ? "🟢 Online" : "🔴 Offline";

      const txt =
        `🖥️ *Check Host: ${host}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📡 *Estado:* ${estado}\n` +
        `✅ *Nodos OK:* ${online}/${total}\n` +
        `❌ *Nodos caídos:* ${offline}/${total}\n` +
        `⏱️ *Tiempo:* ${ms}ms`;

      await react("✅");
      return reply(sock, jid, txt, msg);

    } catch (e) {
      await react("❌");
      return reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};