import { loadDB, saveDB, getUser, fmt, numId, TIENDA, MASCOTAS_IDS, NEGOCIOS_IDS } from "./db.js";

// Duración de items con expiración (en ms)
const DURACION = {
  escudo: 24 * 60 * 60 * 1000,       // 24 horas
  vip:     7 * 24 * 60 * 60 * 1000,  // 7 días
  seguro: 48 * 60 * 60 * 1000,       // 48 horas
};

// Usos de items con carga
const USOS = {
  pico:    3,
  dados:   5,
  amuleto: 5,
  elixir:  1,
};

export default {
  name: "comprar",
  aliases: ["buy", "shop", "tienda"],

  async run(sock, msg, args, chatId, isOwner, isGroup, sender) {
    const db   = loadDB();
    const id   = numId(sender);
    const user = getUser(db, id);

    const itemId = args[0]?.toLowerCase();
    // Cantidad a comprar (ej: .comprar dragon 3)
    const cantidad = Math.min(Math.max(parseInt(args[1]) || 1, 1), 10);

    if (!itemId) {
      const mascotas  = TIENDA.filter(i => MASCOTAS_IDS.includes(i.id));
      const negocios  = TIENDA.filter(i => NEGOCIOS_IDS.includes(i.id));
      const items     = TIENDA.filter(i => !MASCOTAS_IDS.includes(i.id) && !NEGOCIOS_IDS.includes(i.id) && !i.id.startsWith("caja"));
      const cajas     = TIENDA.filter(i => i.id.startsWith("caja"));

      let txt = `🛒 *Tienda*\n💵 Tu saldo: ${fmt(user.saldo)}\n\n`;
      txt += `🐾 *Mascotas* _(acumulables)_\n`;
      mascotas.forEach(i => txt += `• *${i.id}* — ${i.nombre} | ${fmt(i.precio)}\n  ↳ ${i.desc}\n`);
      txt += `\n🏢 *Negocios* _(acumulables)_\n`;
      negocios.forEach(i => txt += `• *${i.id}* — ${i.nombre} | ${fmt(i.precio)}\n  ↳ ${i.desc}\n`);
      txt += `\n🎒 *Items*\n`;
      items.forEach(i => txt += `• *${i.id}* — ${i.nombre} | ${fmt(i.precio)}\n  ↳ ${i.desc}\n`);
      txt += `\n📦 *Cajas*\n`;
      cajas.forEach(i => txt += `• *${i.id}* — ${i.nombre} | ${fmt(i.precio)}\n  ↳ ${i.desc}\n`);
      txt += `\n> 💡 Puedes comprar varios a la vez: *comprar dragon 5*`;

      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    const item = TIENDA.find(i => i.id === itemId);
    if (!item) {
      return sock.sendMessage(chatId, {
        text: `❌ Item *${itemId}* no existe.\nUsa *comprar* para ver la lista.`
      }, { quoted: msg });
    }

    const costoTotal = item.precio * cantidad;

    if (user.saldo < costoTotal) {
      return sock.sendMessage(chatId, {
        text:
          `❌ Saldo insuficiente.\n` +
          `💵 Tienes: ${fmt(user.saldo)}\n` +
          `💰 Necesitas: ${fmt(costoTotal)}` +
          (cantidad > 1 ? ` (${cantidad}x ${fmt(item.precio)})` : "")
      }, { quoted: msg });
    }

    // ── MASCOTAS (acumulables por cantidad) ───────────────────
    if (MASCOTAS_IDS.includes(itemId)) {
      if (!Array.isArray(user.mascotas)) user.mascotas = [];

      const entrada = user.mascotas.find(m => m.tipo === itemId);
      if (entrada) {
        entrada.cantidad += cantidad;
      } else {
        user.mascotas.push({ tipo: itemId, cantidad, compradoEn: Date.now() });
      }

      user.saldo -= costoTotal;
      saveDB(db);

      const totalTipo = user.mascotas.find(m => m.tipo === itemId)?.cantidad || cantidad;

      return sock.sendMessage(chatId, {
        text:
          `✅ ¡Compraste *${cantidad}x ${item.nombre}*!\n` +
          `💸 Pagaste: ${fmt(costoTotal)}\n` +
          `💵 Saldo restante: ${fmt(user.saldo)}\n` +
          `🐾 Total de este tipo: *${totalTipo}*\n\n` +
          `Cobra sus ganancias con *mascota*`
      }, { quoted: msg });
    }

    // ── NEGOCIOS (acumulables por cantidad) ───────────────────
    if (NEGOCIOS_IDS.includes(itemId)) {
      if (!Array.isArray(user.negocios)) user.negocios = [];

      const entrada = user.negocios.find(n => n.tipo === itemId);
      if (entrada) {
        entrada.cantidad += cantidad;
      } else {
        user.negocios.push({ tipo: itemId, cantidad, compradoEn: Date.now() });
      }

      user.saldo -= costoTotal;
      saveDB(db);

      const totalTipo = user.negocios.find(n => n.tipo === itemId)?.cantidad || cantidad;

      return sock.sendMessage(chatId, {
        text:
          `✅ ¡Compraste *${cantidad}x ${item.nombre}*!\n` +
          `💸 Pagaste: ${fmt(costoTotal)}\n` +
          `💵 Saldo restante: ${fmt(user.saldo)}\n` +
          `🏢 Total de este tipo: *${totalTipo}*\n\n` +
          `Cobra sus ganancias con *negocio*`
      }, { quoted: msg });
    }

    // ── ITEMS DE INVENTARIO ───────────────────────────────────
    user.saldo -= costoTotal;
    if (!Array.isArray(user.inventario)) user.inventario = [];

    for (let i = 0; i < cantidad; i++) {
      const entrada = { id: itemId, compradoEn: Date.now() };

      // Items con expiración por tiempo
      if (DURACION[itemId]) {
        entrada.expira = Date.now() + DURACION[itemId];
      }

      // Items con usos limitados
      if (USOS[itemId]) {
        entrada.usos = USOS[itemId];
      }

      user.inventario.push(entrada);
    }

    saveDB(db);

    // Mensaje de confirmación con info extra según el tipo
    let extra = "";
    if (DURACION[itemId]) {
      const horas = DURACION[itemId] / (60 * 60 * 1000);
      extra = `\n⏳ Activo por: *${horas >= 24 ? `${horas / 24} días` : `${horas}h`}*`;
    }
    if (USOS[itemId]) {
      extra = `\n🔢 Usos disponibles: *${USOS[itemId] * cantidad}*`;
    }

    return sock.sendMessage(chatId, {
      text:
        `✅ ¡Compraste *${cantidad}x ${item.nombre}*!\n` +
        `💸 Pagaste: ${fmt(costoTotal)}\n` +
        `💵 Saldo restante: ${fmt(user.saldo)}` +
        extra
    }, { quoted: msg });
  }
};