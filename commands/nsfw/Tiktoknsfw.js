import axios from "axios";
import fs from "fs";
import path from "path";
import { reply } from "../../utils.js";

const DB_PATH = path.resolve("./data/nsfw_groups.json");

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function isNsfwEnabled(jid) {
  const db = loadDB();
  return db.groups?.[jid]?.nsfw === true;
}

export default {
  name: "tiktoknsfw",
  aliases: ["ttnsfw", "tiktok18"],
  run: async (sock, msg, args, jid) => {
    try {
      if (!isNsfwEnabled(jid))
        return reply(sock, jid, "🚫 El contenido NSFW está desactivado.\n\nUn admin debe usar *.nsfw on*", msg);

      const response = await axios.get("https://api.delirius.store/nsfw/tiktok", { responseType: "arraybuffer" });
      const contentType = response.headers["content-type"] || "";
      const buffer = Buffer.from(response.data);

      if (contentType.includes("video")) {
        await sock.sendMessage(jid, { video: buffer, caption: "TikTok 🔞", mimetype: "video/mp4" }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { image: buffer, caption: "TikTok 🔞" }, { quoted: msg });
      }
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};