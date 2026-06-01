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

    if (!db.usuarios) {
      db.usuarios = {};
    }

    if (!db.loteria) {
      db.loteria = {
        pozo: 0,
        participantes: []
      };
    }

    return db;

  } catch {
    return {
      usuarios: {},
      loteria: {
        pozo: 0,
        participantes: []
      }
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

  // Negocios
  negocio: null,
  lastNegocio: 0,

  // Mascotas
  mascota: null,
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

  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (db.usuarios[id][k] === undefined) {
      db.usuarios[id][k] = structuredClone(v);
    }
  }

  return db.usuarios[id];
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
  return String(jid)
    .split("@")[0]
    .replace(/\D/g, "");
}

// Resolver LID → número real
export async function resolverId(jid = "", sock = null, chatId = null) {

  if (!jid.endsWith("@lid")) {
    return numId(jid);
  }

  if (sock && chatId) {
    try {
      const meta = await sock.groupMetadata(chatId);

      const raw = numId(jid);

      const p = meta.participants.find(
        p =>
          p.id === jid ||
          numId(p.id) === raw ||
          (p.phoneNumber &&
            p.phoneNumber.replace(/\D/g, "") === raw)
      );

      if (p) {
        if (p.phoneNumber) {
          return p.phoneNumber.replace(/\D/g, "");
        }

        if (p.id && !p.id.endsWith("@lid")) {
          return numId(p.id);
        }
      }

    } catch {}
  }

  return numId(jid);
}

// Tienda global
export const TIENDA = [
  {
    id: "escudo",
    nombre: "🛡️ Escudo Anti-Robo",
    precio: 5000,
    desc: "Protege tu saldo de robos por 24h"
  },
  {
    id: "vip",
    nombre: "⭐ Membresía VIP",
    precio: 20000,
    desc: "Daily doble por 7 días"
  },
  {
    id: "pico",
    nombre: "⛏️ Pico de Trabajo",
    precio: 8000,
    desc: "Duplica ganancias del .trabajo por 3 usos"
  },
  {
    id: "dados",
    nombre: "🎲 Dados Cargados",
    precio: 15000,
    desc: "+20% de ganar en ruleta por 5 usos"
  }
];