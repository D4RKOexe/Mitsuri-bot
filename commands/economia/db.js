import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("./data/economia.json");

export function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          usuarios: {},
          loteria: {
            pozo: 0,
            participantes: []
          }
        },
        null,
        2
      )
    );
  }

  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (!db.usuarios) db.usuarios = {};
    if (!db.loteria) db.loteria = { pozo: 0, participantes: [] };
    return db;
  } catch {
    return {
      usuarios: {},
      loteria: { pozo: 0, participantes: [] }
    };
  }
}

export function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const DEFAULTS = {
  saldo: 0,
  banco: 0,
  nombre: null,

  // Cooldowns
  lastDaily: 0,
  lastTrabajo: 0,
  lastRobo: 0,
  lastPesca: 0,
  lastMina: 0,
  lastCofre: 0,

  // Inversiones
  inversion: null,

  // Negocios (colección)
  negocios: [],
  lastNegocio: 0,

  // Mascotas (colección)
  mascotas: [],
  lastMascota: 0,

  // Banco con intereses
  lastInteres: 0,

  // Inventario
  inventario: [],

  // Estadísticas
  estadisticas: {
    trabajos: 0,
    robos: 0,
    pesca: 0,
    mineria: 0
  },

  // Misiones
  misiones: {
    ultima: 0
  }
};

export function getUser(db, id) {
  if (!db.usuarios[id]) {
    db.usuarios[id] = structuredClone(DEFAULTS);
  }

  const user = db.usuarios[id];

  // --- MIGRACIÓN AUTOMÁTICA ---

  // mascota (singular) → mascotas[]
  if (user.mascota !== undefined) {
    if (!Array.isArray(user.mascotas)) user.mascotas = [];
    if (user.mascota !== null) {
      const tipo = typeof user.mascota === "string" ? user.mascota : user.mascota?.tipo;
      if (tipo && !user.mascotas.some(m => m.tipo === tipo)) {
        user.mascotas.push({ tipo, compradoEn: Date.now() });
      }
    }
    delete user.mascota;
  }

  // negocio (singular) → negocios[]
  if (user.negocio !== undefined) {
    if (!Array.isArray(user.negocios)) user.negocios = [];
    if (user.negocio !== null) {
      const tipo = typeof user.negocio === "string" ? user.negocio : user.negocio?.tipo;
      if (tipo && !user.negocios.some(n => n.tipo === tipo)) {
        user.negocios.push({ tipo, compradoEn: Date.now() });
      }
    }
    delete user.negocio;
  }

  // Rellenar campos faltantes con defaults
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (user[k] === undefined) {
      user[k] = structuredClone(v);
    }
  }

  return user;
}

export function saveNombre(db, id, pushName) {
  if (!db.usuarios[id]) {
    db.usuarios[id] = structuredClone(DEFAULTS);
  }
  if (pushName && pushName.trim()) {
    db.usuarios[id].nombre = pushName.trim();
  }
}

export function fmt(n) {
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function numId(jid = "") {
  return String(jid).split("@")[0].replace(/\D/g, "");
}

export async function resolverId(jid = "", sock = null, chatId = null) {
  if (!jid.endsWith("@lid")) return numId(jid);

  if (sock && chatId) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const raw = numId(jid);
      const p = meta.participants.find(
        p =>
          p.id === jid ||
          numId(p.id) === raw ||
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

// Tienda global
export const TIENDA = [
  { id: "escudo",          nombre: "🛡️ Escudo Anti-Robo",      precio: 5000,    desc: "Protege tu saldo de robos por 24h" },
  { id: "vip",             nombre: "⭐ Membresía VIP",           precio: 20000,   desc: "Daily doble por 7 días" },
  { id: "pico",            nombre: "⛏️ Pico de Trabajo",         precio: 8000,    desc: "Duplica ganancias del .trabajo por 3 usos" },
  { id: "dados",           nombre: "🎲 Dados Cargados",          precio: 15000,   desc: "+20% de ganar en ruleta por 5 usos" },
  { id: "perro",           nombre: "🐕 Perro",                   precio: 50000,   desc: "Genera dinero cada hora" },
  { id: "gato",            nombre: "🐈 Gato",                    precio: 100000,  desc: "Genera más dinero que el perro" },
  { id: "zorro",           nombre: "🦊 Zorro",                   precio: 250000,  desc: "Mascota avanzada" },
  { id: "dragon",          nombre: "🐉 Dragón",                  precio: 1000000, desc: "Mascota legendaria" },
  { id: "puesto",          nombre: "🥤 Puesto de Limonada",      precio: 100000,  desc: "Produce ingresos pasivos" },
  { id: "tienda",          nombre: "🏪 Tienda",                  precio: 500000,  desc: "Produce más ingresos" },
  { id: "empresa",         nombre: "🏢 Empresa",                 precio: 5000000, desc: "Produce grandes ingresos" },
  { id: "cajacomun",       nombre: "📦 Caja Común",              precio: 25000,   desc: "Premios aleatorios" },
  { id: "cajarara",        nombre: "🎁 Caja Rara",               precio: 100000,  desc: "Mejores premios" },
  { id: "cajalegendaria",  nombre: "💎 Caja Legendaria",         precio: 500000,  desc: "Premios épicos" }
];

// IDs de mascotas y negocios para validación rápida
export const MASCOTAS_IDS  = ["perro", "gato", "zorro", "dragon"];
export const NEGOCIOS_IDS  = ["puesto", "tienda", "empresa"];