import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { isOwner } from "../admin/utils.js";
import { reply } from "../../utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "buenasnoches_config.json");

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── Persistencia ─────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(DATA_FILE)) return fs.readJsonSync(DATA_FILE);
  } catch (e) {
    console.error("⚠️ buenasnoches: error cargando config:", e.message);
  }
  return {};
}

function saveConfig(data) {
  try {
    fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
  } catch (e) {
    console.error("⚠️ buenasnoches: error guardando config:", e.message);
  }
}

// ─── Generar mensaje con IA ───────────────────────────────────────────────────
async function generarMensaje(tipo = "noches") {
  try {
    const estilosNoches = [
      "poético y romántico con metáforas de la noche y las estrellas",
      "divertido y con emojis, como si fuera para amigos del grupo",
      "motivacional y positivo para cerrar bien el día",
      "misterioso y con referencias a la luna y los sueños",
      "tierno y cariñoso como si fuera de un amigo cercano",
      "filosófico y reflexivo sobre el descanso y la vida",
    ];

    const estilosDias = [
      "energético y motivador para empezar el día con fuerza",
      "alegre y positivo con referencias al amanecer",
      "tierno y cariñoso para despertar con buena vibra",
      "divertido y con emojis para animar a todos",
      "inspiracional con frases para arrancar el día",
    ];

    const estilos = tipo === "noches" ? estilosNoches : estilosDias;
    const estilo = estilos[Math.floor(Math.random() * estilos.length)];
    const esNoches = tipo === "noches";

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Eres un creativo que escribe mensajes para grupos de WhatsApp.
Escribe mensajes originales, creativos y diferentes cada vez.
Usa emojis apropiados.
El mensaje debe ser corto, máximo 6 líneas.
No uses asteriscos de markdown excepto para *negritas* importantes.
${esNoches
  ? "Siempre termina mencionando que el grupo se cierra por esta noche."
  : "Siempre termina mencionando que el grupo está abierto y desea un excelente día."
}`
          },
          {
            role: "user",
            content: `Escribe un mensaje de ${esNoches ? "buenas noches" : "buenos días"} para un grupo de WhatsApp.
Estilo: ${estilo}.
El mensaje debe ser único y diferente, nunca repetitivo.`
          }
        ],
        max_tokens: 200,
        temperature: 1.2,
      })
    });

    const data = await response.json();
    const mensaje = data.choices?.[0]?.message?.content;
    if (!mensaje) throw new Error("Respuesta vacía");
    return mensaje;

  } catch (e) {
    console.error("[BUENASNOCHES IA ERROR]", e.message);
    return tipo === "noches"
      ? `🌙 *¡Buenas Noches a todos!*\n\n😴 Que tengan dulces sueños ✨\n\n🔒 *El grupo se cierra por esta noche*`
      : `☀️ *¡Buenos Días a todos!*\n\n🌅 Que tengan un excelente día ✨\n\n🔓 *El grupo está abierto*`;
  }
}

// ─── Ejecutar cierre nocturno ─────────────────────────────────────────────────
async function ejecutarNoches(sock, jid) {
  try {
    console.log(`[BUENASNOCHES] Ejecutando cierre automático en ${jid}`);
    const mensaje = await generarMensaje("noches");
    await sock.sendMessage(jid, { text: mensaje });
    await sock.groupSettingUpdate(jid, "announcement");
    console.log(`[BUENASNOCHES] Grupo ${jid} cerrado exitosamente`);
  } catch (e) {
    console.error(`[BUENASNOCHES] Error cerrando ${jid}:`, e.message);
  }
}

// ─── Ejecutar apertura matutina ───────────────────────────────────────────────
async function ejecutarDias(sock, jid) {
  try {
    console.log(`[BUENASNOCHES] Ejecutando apertura automática en ${jid}`);
    await sock.groupSettingUpdate(jid, "not_announcement");
    const mensaje = await generarMensaje("dias");
    await sock.sendMessage(jid, { text: mensaje });
    console.log(`[BUENASNOCHES] Grupo ${jid} abierto exitosamente`);
  } catch (e) {
    console.error(`[BUENASNOCHES] Error abriendo ${jid}:`, e.message);
  }
}

// ─── Iniciar cron jobs ────────────────────────────────────────────────────────
export function iniciarCronBuenasNoches(sock) {
  // Cierre a las 10:00 PM
  cron.schedule("0 22 * * *", async () => {
    console.log("[CRON] Ejecutando buenas noches automático...");
    const config = loadConfig();
    for (const [jid, datos] of Object.entries(config)) {
      if (datos.activo) await ejecutarNoches(sock, jid);
    }
  }, { timezone: "America/Bogota" }); // cambia tu zona horaria

  // Apertura a las 6:00 AM
  cron.schedule("0 6 * * *", async () => {
    console.log("[CRON] Ejecutando buenos días automático...");
    const config = loadConfig();
    for (const [jid, datos] of Object.entries(config)) {
      if (datos.activo) await ejecutarDias(sock, jid);
    }
  }, { timezone: "America/Bogota" });

  console.log("✅ Cron buenas noches iniciado (22:00 cierre / 06:00 apertura)");
}

// ─── Comando ──────────────────────────────────────────────────────────────────
export default {
  name: "buenasnoches",
  aliases: ["bn", "goodnight", "cerrargrupo"],
  run: async (sock, msg, args, jid, sender) => {
    if (!isOwner(sender)) {
      return reply(sock, jid, "❌ Solo el owner puede usar este comando.", msg);
    }

    if (!jid.endsWith("@g.us")) {
      return reply(sock, jid, "❌ Este comando solo funciona en grupos.", msg);
    }

    const sub = (args[0] || "").toLowerCase();
    const config = loadConfig();

    // ─── Ver estado ───────────────────────────────────────────────────────
    if (!sub || sub === "status") {
      const activo = config[jid]?.activo ?? false;
      return reply(sock, jid,
        `🌙 *Buenas Noches Automático*\n\n` +
        `Estado: ${activo ? "🟢 *ACTIVADO*" : "🔴 *DESACTIVADO*"}\n` +
        `🕙 Cierre: *10:00 PM*\n` +
        `🌅 Apertura: *6:00 AM*\n\n` +
        `📌 Uso:\n*.bn on* — activar en este grupo\n*.bn off* — desactivar en este grupo\n*.bn now* — cerrar ahora\n*.bn open* — abrir ahora`,
        msg
      );
    }

    // ─── Activar ──────────────────────────────────────────────────────────
    if (sub === "on") {
      config[jid] = { activo: true };
      saveConfig(config);
      return reply(sock, jid,
        "✅ *Buenas noches automático activado en este grupo.*\n\n🕙 Se cerrará a las *10:00 PM*\n🌅 Se abrirá a las *6:00 AM*",
        msg
      );
    }

    // ─── Desactivar ───────────────────────────────────────────────────────
    if (sub === "off") {
      config[jid] = { activo: false };
      saveConfig(config);
      return reply(sock, jid, "🔴 *Buenas noches automático desactivado en este grupo.*", msg);
    }

    // ─── Cerrar ahora ─────────────────────────────────────────────────────
    if (sub === "now") {
      await reply(sock, jid, "🌙 *Generando mensaje y cerrando grupo...*", msg);
      await ejecutarNoches(sock, jid);
      return;
    }

    // ─── Abrir ahora ──────────────────────────────────────────────────────
    if (sub === "open") {
      await reply(sock, jid, "☀️ *Generando mensaje y abriendo grupo...*", msg);
      await ejecutarDias(sock, jid);
      return;
    }

    return reply(sock, jid,
      "❓ Uso:\n*.bn on* — activar auto\n*.bn off* — desactivar auto\n*.bn now* — cerrar ahora\n*.bn open* — abrir ahora\n*.bn status* — ver estado",
      msg
    );
  },
};