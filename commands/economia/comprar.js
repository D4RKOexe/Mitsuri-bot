import { loadDB, saveDB, getUser, fmt, numId, TIENDA, MASCOTAS_IDS, NEGOCIOS_IDS } from "./db.js";

export default {
  name: "comprar",

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    const itemId = args[0]?.toLowerCase();

    if (!itemId) {
      const lista = TIENDA.map(i => `• *comprar ${i.id}* — ${i.nombre} | ${fmt(i.precio)}\n  ↳ ${i.desc}`).join("\n");
      return sock.sendMessage(chatId, {
        text: `🛒 *Tienda*\n\n${lista}\n\n💵 Tu saldo: ${fmt(user.saldo)}`
      });
    }

    const item = TIENDA.find(i => i.id === itemId);

    if (!item) {
      return sock.sendMessage(chatId, {
        text: `❌ Item *${itemId}* no existe en la tienda.\nUsa *comprar* para ver la lista.`
      });
    }

    if (user.saldo < item.precio) {
      return sock.sendMessage(chatId, {
        text: `❌ Saldo insuficiente.\n💵 Tienes: ${fmt(user.saldo)}\n💰 Necesitas: ${fmt(item.precio)}`
      });
    }

    // --- MASCOTAS ---
    if (MASCOTAS_IDS.includes(itemId)) {
      if (!Array.isArray(user.mascotas)) user.mascotas = [];

      const yaLaTiene = user.mascotas.some(m => (typeof m === "string" ? m : m.tipo) === itemId);
      if (yaLaTiene) {
        return sock.sendMessage(chatId, {
          text: `❌ Ya tienes un(a) *${item.nombre}*. No puedes comprar la misma mascota dos veces.`
        });
      }

      user.saldo -= item.precio;
      user.mascotas.push({ tipo: itemId, compradoEn: Date.now() });
      saveDB(db);

      return sock.sendMessage(chatId, {
        text:
          `✅ ¡Compraste *${item.nombre}*!\n` +
          `💸 Pagaste: ${fmt(item.precio)}\n` +
          `💵 Saldo restante: ${fmt(user.saldo)}\n\n` +
          `Cobra sus ganancias con *mascota*`
      });
    }

    // --- NEGOCIOS ---
    if (NEGOCIOS_IDS.includes(itemId)) {
      if (!Array.isArray(user.negocios)) user.negocios = [];

      const yaLoTiene = user.negocios.some(n => (typeof n === "string" ? n : n.tipo) === itemId);
      if (yaLoTiene) {
        return sock.sendMessage(chatId, {
          text: `❌ Ya tienes una *${item.nombre}*. No puedes comprar el mismo negocio dos veces.`
        });
      }

      user.saldo -= item.precio;
      user.negocios.push({ tipo: itemId, compradoEn: Date.now() });
      saveDB(db);

      return sock.sendMessage(chatId, {
        text:
          `✅ ¡Compraste *${item.nombre}*!\n` +
          `💸 Pagaste: ${fmt(item.precio)}\n` +
          `💵 Saldo restante: ${fmt(user.saldo)}\n\n` +
          `Cobra sus ganancias con *negocio*`
      });
    }

    // --- ITEMS DE INVENTARIO (escudo, vip, pico, dados, cajas) ---
    user.saldo -= item.precio;
    if (!Array.isArray(user.inventario)) user.inventario = [];
    user.inventario.push({ id: itemId, compradoEn: Date.now() });
    saveDB(db);

    await sock.sendMessage(chatId, {
      text:
        `✅ ¡Compraste *${item.nombre}*!\n` +
        `💸 Pagaste: ${fmt(item.precio)}\n` +
        `💵 Saldo restante: ${fmt(user.saldo)}`
    });
  }
};