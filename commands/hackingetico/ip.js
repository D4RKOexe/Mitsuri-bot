import axios from "axios";
import { reply } from "../../utils.js";

export default {
  name: "ip",
  aliases: ["ipinfo", "geoip"],
  description: "Info de una dirección IP",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const ip = args[0]?.trim();
    if (!ip) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe una IP.\nEj: `.ip 8.8.8.8`", msg);
    }

    await react("⏳");

    try {
      const { data } = await axios.get(`http://ip-api.com/json/${ip}?lang=es`, { timeout: 10000 });

      if (data.status === "fail") throw new Error(data.message || "IP inválida o privada.");

      const txt =
        `🌐 *Info de IP: ${ip}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🏳️ *País:* ${data.country || "?"} (${data.countryCode || "?"})\n` +
        `🏙️ *Ciudad:* ${data.city || "?"}\n` +
        `🗺️ *Región:* ${data.regionName || "?"}\n` +
        `🏢 *ISP:* ${data.isp || "?"}\n` +
        `🏛️ *Org:* ${data.org || "?"}\n` +
        `📡 *AS:* ${data.as || "?"}\n` +
        `📍 *Coords:* ${data.lat}, ${data.lon}\n` +
        `🕐 *Zona horaria:* ${data.timezone || "?"}\n` +
        `📮 *Zip:* ${data.zip || "?"}`;

      await react("✅");
      return reply(sock, jid, txt, msg);

    } catch (e) {
      await react("❌");
      return reply(sock, jid, `❌ ${e.message}`, msg);
    }
  },
};