import axios from "axios";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;

export default {
  name: "mega",
  aliases: ["mg"],

  run: async (sock, msg, args, jid) => {
    await sock.sendMessage(jid, {
      text: "🔧 *Comando en mantenimiento por falta de presupuesto*\n\n> _Estamos trabajando para mejorar este comando, vuelve pronto._"
    }, { quoted: msg });
  },
};