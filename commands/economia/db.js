import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("./data/economia.json");

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ usuarios: {}, loteria: { pozo: 0, participantes: [] } }, null, 2));
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!db.usuarios) db.usuarios = {};
    if (!db.loteria)  db.loteria  = { pozo: 0, participantes: [] };
    return db;
  } catch {
    return { usuarios: {}, loteria: { pozo: 0, participantes: [] } };
  }
}

export function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const DEFAULTS = {
  saldo: 0, banco: 0, nombre: null,
  lastDaily: 0, lastTrabajo: 0, lastRobo: 0,
  lastPesca: 0, lastMina: 0, lastCofre: 0,
  inversion: null,
  negocios: [], lastNegocio: 0,
  mascotas: [], lastMascota: 0,
  lastInteres: 0,
  inventario: [],
  estadisticas: { trabajos: 0, robos: 0, pesca: 0, mineria: 0 },
  misiones: { ultima: 0 }
};

export function getUser(db, id) {
  if (!db.usuarios[id]) db.usuarios[id] = structuredClone(DEFAULTS);
  const user = db.usuarios[id];

  // MIGRACIÓN: mascota → mascotas[]
  if (user.mascota !== undefined) {
    if (!Array.isArray(user.mascotas)) user.mascotas = [];
    if (user.mascota !== null) {
      const tipo = typeof user.mascota === "string" ? user.mascota : user.mascota?.tipo;
      if (tipo) user.mascotas.push({ tipo, cantidad: 1, compradoEn: Date.now() });
    }
    delete user.mascota;
  }

  // MIGRACIÓN: negocio → negocios[]
  if (user.negocio !== undefined) {
    if (!Array.isArray(user.negocios)) user.negocios = [];
    if (user.negocio !== null) {
      const tipo = typeof user.negocio === "string" ? user.negocio : user.negocio?.tipo;
      if (tipo) user.negocios.push({ tipo, cantidad: 1, compradoEn: Date.now() });
    }
    delete user.negocio;
  }

  // MIGRACIÓN: mascotas antiguas sin cantidad → agregar cantidad: 1
  if (Array.isArray(user.mascotas)) {
    user.mascotas = user.mascotas.map(m => ({
      tipo:       typeof m === "string" ? m : m.tipo,
      cantidad:   m.cantidad ?? 1,
      compradoEn: m.compradoEn ?? Date.now()
    }));
    // Consolidar duplicados del mismo tipo en una sola entrada
    const map = new Map();
    for (const m of user.mascotas) {
      if (map.has(m.tipo)) map.get(m.tipo).cantidad += m.cantidad;
      else map.set(m.tipo, { ...m });
    }
    user.mascotas = [...map.values()];
  }

  // MIGRACIÓN: negocios antiguos sin cantidad
  if (Array.isArray(user.negocios)) {
    user.negocios = user.negocios.map(n => ({
      tipo:       typeof n === "string" ? n : n.tipo,
      cantidad:   n.cantidad ?? 1,
      compradoEn: n.compradoEn ?? Date.now()
    }));
    const map = new Map();
    for (const n of user.negocios) {
      if (map.has(n.tipo)) map.get(n.tipo).cantidad += n.cantidad;
      else map.set(n.tipo, { ...n });
    }
    user.negocios = [...map.values()];
  }

  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (user[k] === undefined) user[k] = structuredClone(v);
  }

  return user;
}

export function saveNombre(db, id, pushName) {
  if (!db.usuarios[id]) db.usuarios[id] = structuredClone(DEFAULTS);
  if (pushName && pushName.trim()) db.usuarios[id].nombre = pushName.trim();
}

export function fmt(n) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function numId(jid = "") {
  return String(jid).split("@")[0].replace(/\D/g, "");
}

export async function resolverId(jid = "", sock = null, chatId = null) {
  if (!jid.endsWith("@lid")) return numId(jid);
  if (sock && chatId) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const raw  = numId(jid);
      const p    = meta.participants.find(p =>
        p.id === jid || numId(p.id) === raw ||
        (p.phoneNumber && p.phoneNumber.replace(/\D/g, "") === raw)
      );
      if (p) {
        if (p.phoneNumber) return p.phoneNumber.replace(/\D/g, "");
        if (p.id && !p.id.endsWith("@lid")) return numId(p.id);
      }
    } catch {}
  }
  return numId(jid);
}

// ══════════════════════════════════════════
//  TIENDA
// ══════════════════════════════════════════
export const TIENDA = [
  // Items de inventario
  { id: "escudo",         nombre: "🛡️ Escudo Anti-Robo",      precio: 1000000,   desc: "Protege tu saldo de robos por 24h" },
  { id: "vip",            nombre: "⭐ Membresía VIP",            precio: 20000,    desc: "Daily doble por 7 días" },
  { id: "pico",           nombre: "⛏️ Pico de Trabajo",          precio: 8000,     desc: "Duplica ganancias del .trabajo por 3 usos" },
  { id: "dados",          nombre: "🎲 Dados Cargados",           precio: 15000,    desc: "+20% de ganar en ruleta por 5 usos" },
  { id: "amuleto",        nombre: "🧿 Amuleto de la Suerte",     precio: 30000,    desc: "+30% ganancias en pesca y minería por 5 usos" },
  { id: "seguro",         nombre: "📋 Seguro Bancario",          precio: 50000,    desc: "Protege tu banco de eventos negativos por 48h" },
  { id: "elixir",         nombre: "🧪 Elixir de Trabajo",        precio: 25000,    desc: "Triplica ganancias del .trabajo por 1 uso" },

  // Mascotas — acumulables, se suman
  { id: "perro",          nombre: "🐕 Perro",                    precio: 50000,    desc: "Genera $5,000/hr — acumulable" },
  { id: "gato",           nombre: "🐈 Gato",                     precio: 100000,   desc: "Genera $10,000/hr — acumulable" },
  { id: "zorro",          nombre: "🦊 Zorro",                    precio: 250000,   desc: "Genera $25,000/hr — acumulable" },
  { id: "dragon",         nombre: "🐉 Dragón",                   precio: 1000000,  desc: "Genera $100,000/hr — acumulable" },
  { id: "fenix",          nombre: "🔥 Fénix",                    precio: 5000000,  desc: "Genera $500,000/hr — mascota legendaria" },
  { id: "unicornio",      nombre: "🦄 Unicornio",                precio: 2000000,  desc: "Genera $200,000/hr — mascota mágica" },

  // Negocios — acumulables, se suman
  { id: "puesto",         nombre: "🥤 Puesto de Limonada",       precio: 100000,   desc: "Genera $10,000/hr — acumulable" },
  { id: "tienda",         nombre: "🏪 Tienda",                   precio: 500000,   desc: "Genera $50,000/hr — acumulable" },
  { id: "empresa",        nombre: "🏢 Empresa",                  precio: 5000000,  desc: "Genera $250,000/hr — acumulable" },
  { id: "fabrica",        nombre: "🏭 Fábrica",                  precio: 10000000, desc: "Genera $600,000/hr — acumulable" },
  { id: "banco_neg",      nombre: "🏦 Banco Privado",            precio: 50000000, desc: "Genera $3,000,000/hr — negocio élite" },
  { id: "casino",         nombre: "🎰 Casino",                   precio: 20000000, desc: "Genera $1,500,000/hr — acumulable" },

  // Cajas
  { id: "cajacomun",      nombre: "📦 Caja Común",               precio: 12000,    desc: "Premios aleatorios" },
  { id: "cajarara",       nombre: "🎁 Caja Rara",                precio: 75000,    desc: "Mejores premios" },
  { id: "cajalegendaria", nombre: "💎 Caja Legendaria",          precio: 250000,   desc: "Premios épicos" },
  { id: "cajamistica",    nombre: "🌌 Caja Mística",             precio: 2000000,  desc: "Premios exclusivos — alto riesgo, alta recompensa" },];

export const MASCOTAS_IDS = ["perro", "gato", "zorro", "dragon", "fenix", "unicornio"];
export const NEGOCIOS_IDS = ["puesto", "tienda", "empresa", "fabrica", "banco_neg", "casino"];