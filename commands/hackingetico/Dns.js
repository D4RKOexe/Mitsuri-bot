import axios from "axios";
import { reply } from "../../utils.js";

export default {
  name: "dns",
  aliases: ["dnsinfo", "dnslookup"],
  description: "Consulta DNS de un dominio",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const domain = args[0]?.trim().replace(/https?:\/\//i, "").split("/")[0];
    if (!domain) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe un dominio.\nEj: `.dns google.com`", msg);
    }

    await react("⏳");

    try {
      const tipos = ["A", "MX", "NS", "TXT", "AAAA"];
      let txt = `🌐 *DNS: ${domain}*\n━━━━━━━━━━━━━━━━━━━━\n`;

      for (const tipo of tipos) {
        try {
          const { data } = await axios.get(
            `https://dns.google/resolve?name=${domain}&type=${tipo}`,
            { timeout: 8000 }
          );
          const respuestas = data?.Answer?.map(r => r.data).join(", ") || "—";
          txt += `\n*${tipo}:* ${respuestas}`;
        } catch {
          txt += `\n*${tipo}:* —`;
        }
      }

      await react("✅");
      return reply(sock, jid, txt, msg);

    } catch (e) {
      await react("❌");
      return reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};