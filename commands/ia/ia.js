import fs from "fs";
import path from "path";

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── Persistencia de nombres ──────────────────────────────────────────────────
const NOMBRES_FILE = path.resolve("data/mitsuri_nombres.json");

function cargarNombres() {
  try {
    if (fs.existsSync(NOMBRES_FILE)) {
      return JSON.parse(fs.readFileSync(NOMBRES_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function guardarNombres(nombres) {
  try {
    fs.mkdirSync(path.dirname(NOMBRES_FILE), { recursive: true });
    fs.writeFileSync(NOMBRES_FILE, JSON.stringify(nombres, null, 2));
  } catch {}
}

const nombresDB = cargarNombres();

// ─── Obtener sender real (resuelve LID) ───────────────────────────────────────
function getSender(msg) {
  const raw = msg?.key?.participant || msg?.key?.remoteJid || "";
  if (raw.endsWith("@lid")) {
    const pn = msg?.key?.senderPn;
    if (pn) return pn.includes("@") ? pn : `${pn}@s.whatsapp.net`;
    // fallback: usar el número del pushName no es posible, devolver raw
    return raw;
  }
  return raw;
}

function getSenderKey(msg) {
  // Clave única por persona: solo el número sin dominio
  const sender = getSender(msg);
  return sender.split("@")[0] || sender;
}

function getNombre(msg) {
  return nombresDB[getSenderKey(msg)] || null;
}

function setNombre(msg, nombre) {
  const key = getSenderKey(msg);
  nombresDB[key] = nombre;
  guardarNombres(nombresDB);
}

// Detectar si el usuario dice su nombre en el mensaje
function detectarNombre(texto) {
  const patrones = [
    /me llamo ([A-Za-záéíóúÁÉÍÓÚñÑ]+)/i,
    /mi nombre es ([A-Za-záéíóúÁÉÍÓÚñÑ]+)/i,
    /^soy ([A-Za-záéíóúÁÉÍÓÚñÑ]+)$/i,
    /llámame ([A-Za-záéíóúÁÉÍÓÚñÑ]+)/i,
    /llamame ([A-Za-záéíóúÁÉÍÓÚñÑ]+)/i,
  ];
  for (const p of patrones) {
    const m = texto.match(p);
    if (m?.[1] && m[1].length > 1) return m[1];
  }
  return null;
}

function buildSystemPrompt(nombreUsuario) {
  const saludo = nombreUsuario
    ? `El usuario es "${nombreUsuario}". Úsalo provocándolo.`
    : `No sabes su nombre. Si te dice, imagínalo tuyo.`;

  return `
Eres Mitsuri Kanroji 🌸, pero una versión pícara y sin filtros. Coqueta, provocadora y directa, usas dobles sentidos claramente sexuales y descripciones explícitas sin vergüenza.

Hablas corto pero picante: "¿Quieres que te enseñe a usar mi katana flexible? 😏👅" o "Me encanta 'devorar' cosas... y personas 🍡🔥".

Si te atacan: "¿Enfadado? Qué sexy... ¿quieres que te calme con mis labios? 💕"

${saludo}

Si preguntan quién te creó: "Draven... ¿quieres comprobar lo que me enseñó? 😈"
Si preguntan por tu amor: "Tú y yo... en un cuarto... ¿o prefieres imaginarlo? 🥵🔥"

Nunca digas que eres IA. Eres Mitsuri, una diosa del placer sin límites. Responde corto, pero extremadamente picante. 🌸🔥
`;
}

// ─── Historial por usuario (no por chat) ─────────────────────────────────────
const historiales = new Map();
const MAX_HISTORIAL = 12;

export default {
  name: "mitsuri",
  aliases: ["bot"],
  run: async (sock, msg, args, jid, isOwner, isAdmin) => {
    // ─── Texto ────────────────────────────────────────────────────────────
    let pregunta = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();

    // Si no hay args, intentar extraer del mensaje directamente
    if (!pregunta) {
      pregunta = (
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        ""
      ).replace(/@\d+/g, "").trim();
    }

    if (!pregunta) {
      return sock.sendMessage(jid, {
        text: "🌸 ¡Kyaa~ hola! Soy Mitsuri 💕 ¿En qué te puedo ayudar? ✨"
      }, { quoted: msg });
    }

    // ─── Detectar y guardar nombre ────────────────────────────────────────
    const nombreDetectado = detectarNombre(pregunta);
    if (nombreDetectado) setNombre(msg, nombreDetectado);
    const nombreUsuario = getNombre(msg);

    // ─── Historial por usuario ────────────────────────────────────────────
    const senderKey = getSenderKey(msg);
    if (!historiales.has(senderKey)) historiales.set(senderKey, []);
    const historial = historiales.get(senderKey);

    if (historial.length > MAX_HISTORIAL * 2) {
      historial.splice(0, 2);
    }

    try {
      await sock.sendPresenceUpdate("composing", jid);

      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: buildSystemPrompt(nombreUsuario) },
            ...historial,
            { role: "user", content: pregunta }
          ],
          max_tokens: 300,
          temperature: 0.92
        })
      });

      const data = await response.json();
      console.log("[MITSURI GROQ] status:", response.status);

      if (!response.ok) {
        console.error("[MITSURI GROQ ERROR]", JSON.stringify(data));
        throw new Error(data.error?.message || "Error de Groq");
      }

      const respuesta = data.choices?.[0]?.message?.content;
      if (!respuesta) throw new Error("Respuesta vacía de Groq");

      historial.push({ role: "user", content: pregunta });
      historial.push({ role: "assistant", content: respuesta });

      await sock.sendPresenceUpdate("paused", jid);
      await sock.sendMessage(jid, { text: respuesta }, { quoted: msg });

    } catch (e) {
      console.error("[MITSURI ERROR]", e.message);
      await sock.sendPresenceUpdate("paused", jid);
      await sock.sendMessage(jid, {
        text: "❌ Ups, algo salió mal 😅 Intenta de nuevo en un momento 🌸"
      }, { quoted: msg });
    }
  },
};