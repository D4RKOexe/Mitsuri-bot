import axios from "axios";
import { reply } from "../../utils.js";

export default {
  name: "whois",
  aliases: ["dominio", "domain"],
  description: "Info WHOIS de un dominio",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const domain = args[0]?.trim().replace(/https?:\/\//i, "").split("/")[0];
    if (!domain) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe un dominio.\nEj: `.whois google.com`", msg);
    }

    await react("⏳");

    try {
      const { data } = await axios.get(`https://api.domainsdb.info/v1/domains/search?domain=${domain}&zone=com`, { timeout: 10000 });

      const info = data?.domains?.[0];
      if (!info) throw new Error("No encontré info para ese dominio.");

      const txt =
        `🔍 *WHOIS: ${domain}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📛 *Dominio:* ${info.domain || "?"}\n` +
        `📅 *Creado:* ${info.create_date?.slice(0, 10) || "?"}\n` +
        `🔄 *Actualizado:* ${info.update_date?.slice(0, 10) || "?"}\n` +
        `✅ *Activo:* ${info.isDead === "False" ? "Sí" : "No"}\n` +
        `🌍 *País:* ${info.country || "?"}\n` +
        `🏢 *Ciudad:* ${info.city || "?"}`;

      await react("✅");
      return reply(sock, jid, txt, msg);

    } catch (e) {
      await react("❌");
      return reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};