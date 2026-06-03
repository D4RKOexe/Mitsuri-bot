import crypto from "crypto";
import { reply } from "../../utils.js";

export default {
  name: "hash",
  aliases: ["md5", "sha256", "encrypt"],
  description: "Genera hash de un texto",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const texto = args.join(" ").trim();
    if (!texto) {
      await react("❌");
      return reply(sock, jid, "❌ Escribe un texto.\nEj: `.hash hola mundo`", msg);
    }

    await react("✅");

    const md5    = crypto.createHash("md5").update(texto).digest("hex");
    const sha1   = crypto.createHash("sha1").update(texto).digest("hex");
    const sha256 = crypto.createHash("sha256").update(texto).digest("hex");
    const sha512 = crypto.createHash("sha512").update(texto).digest("hex");

    const txt =
      `#️⃣ *Hash Generator*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Texto:* ${texto}\n\n` +
      `*MD5:*\n${md5}\n\n` +
      `*SHA1:*\n${sha1}\n\n` +
      `*SHA256:*\n${sha256}\n\n` +
      `*SHA512:*\n${sha512.slice(0, 64)}...`;

    return reply(sock, jid, txt, msg);
  },
};