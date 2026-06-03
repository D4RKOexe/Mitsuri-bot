import axios from "axios";
import { reply } from "../../utils.js";

const APIURL = `${process.env.DV_API_URL}/search/tenor/emoji`;
const APIKEY = process.env.DV_API_KEY;

export default {
  name: "emojimix",
  aliases: ["emojikitchen", "mixemoji", "ek"],

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const query = args.join(" ").trim();
    if (!query) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe dos emojis para combinar.\nEj: `.emojimix 🐱🔥`", msg);
    }

    await react("⏳");

    try {
      const { data } = await axios.get(APIURL, {
        params: { q: query, apikey: APIKEY },
        timeout: 20000,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });

      console.log("[EK] Respuesta:", JSON.stringify(data).slice(0, 200));

      if (!data?.ok) throw new Error(data?.detail || "No encontré combinación.");

      const imgUrl = data.url || data.image || data.result;
      if (!imgUrl) throw new Error("No encontré imagen.");

      await sock.sendMessage(jid, {
        image: { url: imgUrl },
        caption: `✨ *Emoji Kitchen:* ${query}`,
      }, { quoted: msg });

      await react("✅");

    } catch (e) {
      console.error("[EK ERROR]", e.response?.data || e.message);
      await react("❌");
      return reply(sock, jid, `❌ ${e.response?.data?.detail || e.message}`, msg);
    }
  },
};