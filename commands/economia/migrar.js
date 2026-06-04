import { reply } from "../../utils.js";
import { loadDB, saveDB } from "./db.js";

export default {
  name: "migrar",

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);
    }

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
    return reply(sock, jid, `✅ Migración lista — *${arreglados} items* arreglados.`, msg);
  }
};