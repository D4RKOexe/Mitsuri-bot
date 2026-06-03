import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

const TEMP_DIR = "./temp_apk";
const APIURL = `${process.env.DV_API_URL}/apkmod`;
const APIKEY = process.env.DV_API_KEY;

function safeFileName(name) {
  return String(name || "apk_file")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchMod(query) {
  const { data } = await axios.get(APIURL, {
    params: { mode: "link", q: query, pick: 1, apikey: APIKEY },
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  return data;
}

export default {
  name: "apkmod",
  aliases: ["mod", "modapk"],

  run: async (sock, msg, args, jid) => {
    await sock.sendMessage(jid, {
      text: "🔧 *Comando en mantenimiento*\n\n> _Estamos trabajando para mejorar este comando, vuelve pronto._"
    }, { quoted: msg });
  },
};