import fs from "fs";
import path from "path";
import { loadDB, saveDB } from "./db.js";

export default {
  name: "migrar",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    if (!isOwner) return;

    const db = loadDB();
    let arreglados = 0;

    for (const user of Object.values(db.usuarios)) {
      if (!Array.isArray(user.inventario)) continue;

      for (const item of user.inventario) {
        if (item.id === "escudo" && !item.expira) {
          item.expira = Date.now() + 24 * 60 * 60 * 1000;
          arreglados++;
        }
        if (item.id === "vip" && !item.expira) {
          item.expira = Date.now() + 7 * 24 * 60 * 60 * 1000;
          arreglados++;
        }
        if (item.id === "seguro" && !item.expira) {
          item.expira = Date.now() + 48 * 60 * 60 * 1000;
          arreglados++;
        }
        if (["dados", "amuleto"].includes(item.id) && !item.usos) {
          item.usos = 5; arreglados++;
        }
        if (item.id === "pico" && !item.usos) {
          item.usos = 3; arreglados++;
        }
        if (item.id === "elixir" && !item.usos) {
          item.usos = 1; arreglados++;
        }
      }
    }

    saveDB(db);
    return sock.sendMessage(chatId, {
      text: `✅ Migración lista — *${arreglados} items* arreglados.`
    }, { quoted: msg });
  }
};