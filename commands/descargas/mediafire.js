import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

const TEMP_DIR = "./temp_mediafire";

const APIURL = `${process.env.DV_API_URL}/mediafire`;
const APIKEY = process.env.DV_API_KEY;

function extractMediafireUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?mediafire\.com\/[^\s]+/i
  );

  return match ? match[0].trim() : null;
}

function safeFileName(name) {
  return String(name || "mediafire_file")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  name: "mediafire",
  aliases: ["mf", "mdf", "media"],

  run: async (sock, msg, args, jid) => {
    await sock.sendMessage(jid, {
      text: "🔧 *Comando en mantenimiento por falta de presupuesto*\n\n> _Estamos trabajando para mejorar este comando, vuelve pronto._"
    }, { quoted: msg });
  },
};