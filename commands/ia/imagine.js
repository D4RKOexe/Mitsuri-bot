import { getSender } from "../../commands/utilidades/permisos.js";

const BASE_URL = "https://image.pollinations.ai/prompt";

// ─── Cooldown por usuario ─────────────────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_SEGUNDOS = 30; // espera 30 segundos entre imágenes

export default {
  name: "imagine",
  aliases: ["img", "imagen", "generar", "ia2"],
  run: async (sock, msg, args, jid, isOwner, isAdmin) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const prompt = args.join(" ").trim();

    if (!prompt) {
      return sock.sendMessage(jid, {
        text: "🎨 *Generador de Imágenes IA*\n\n📌 Uso: *.imagine <descripción>*\n\n💡 Ejemplos:\n• *.imagine un dragón volando sobre una ciudad*\n• *.imagine una chica anime con cabello azul*\n• *.imagine un paisaje de montañas al atardecer*"
      }, { quoted: msg });
    }

    // ─── Verificar cooldown ───────────────────────────────────────────────
    const ahora = Date.now();
    const ultimaVez = cooldowns.get(sender) || 0;
    const tiempoEspera = COOLDOWN_SEGUNDOS * 1000;
    const tiempoRestante = tiempoEspera - (ahora - ultimaVez);

    if (tiempoRestante > 0) {
      const segundos = Math.ceil(tiempoRestante / 1000);
      return sock.sendMessage(jid, {
        text: `⏳ Espera *${segundos} segundos* antes de pedir otra imagen.`
      }, { quoted: msg });
    }

    // Registrar el tiempo antes de procesar
    cooldowns.set(sender, ahora);

    await sock.sendMessage(jid, {
      text: `🎨 *Generando imagen...*\n\n📝 Prompt: _${prompt}_\n\n⏳ Esto puede tardar unos segundos...`
    }, { quoted: msg });

    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `${BASE_URL}/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

      const response = await fetch(imageUrl, { timeout: 60000 });
      if (!response.ok) throw new Error(`Error al generar: ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1000) throw new Error("Imagen generada inválida");

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🎨 *Imagen generada por IA*\n\n📝 _${prompt}_\n\n🤖 Powered by Pollinations.ai`,
      }, { quoted: msg });

    } catch (e) {
      console.error("[IMAGINE ERROR]", e.message);
      // Si falla, resetear el cooldown para que pueda intentar de nuevo
      cooldowns.delete(sender);
      await sock.sendMessage(jid, {
        text: `❌ No pude generar la imagen.\n\n💡 Intenta con una descripción diferente o más simple.`
      }, { quoted: msg });
    }
  },
};