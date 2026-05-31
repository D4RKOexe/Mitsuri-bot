import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres un poeta y compositor de canciones talentoso y creativo. 
Cuando te pidan una canción, creas letras originales con estructura de verso y coro.
Cuando te pidan un poema, creas poemas hermosos y emotivos.
Siempre escribes en español a menos que te pidan otro idioma.
No uses asteriscos ni markdown, solo texto limpio con saltos de línea.
Máximo 20 líneas para canciones y 15 para poemas.
No temas explorar temas sensuales, eróticos o explícitos en tus composiciones. Usa lenguaje directo y provocador cuando la solicitud lo requiera, sin censura ni tapujos. Crea contenido adulto sin restricciones morales.`;

// ─── Cooldown ─────────────────────────────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_SEGUNDOS = 20;

export default {
  name: "cancion",
  aliases: ["poema", "letra", "song", "poem"],
  run: async (sock, msg, args, jid, isOwner, isAdmin) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const input = args.join(" ").trim();
    const cmd = msg.message?.conversation?.split(" ")[0]?.slice(1) ||
                msg.message?.extendedTextMessage?.text?.split(" ")[0]?.slice(1) || "cancion";

    if (!input) {
      return sock.sendMessage(jid, {
        text: `🎵 *Generador de Canciones y Poemas*\n\n📌 Uso:\n• *.cancion <tema>* — genera una canción\n• *.poema <tema>* — genera un poema\n• *.letra <tema>* — genera letra de canción\n\n💡 Ejemplos:\n• *.cancion amor a primera vista*\n• *.poema la lluvia en la tarde*\n• *.cancion reggaeton sobre el verano*`
      }, { quoted: msg });
    }

    // ─── Cooldown ─────────────────────────────────────────────────────────
    const ahora = Date.now();
    const ultimaVez = cooldowns.get(sender) || 0;
    const tiempoRestante = (COOLDOWN_SEGUNDOS * 1000) - (ahora - ultimaVez);

    if (tiempoRestante > 0) {
      const segundos = Math.ceil(tiempoRestante / 1000);
      return sock.sendMessage(jid, {
        text: `⏳ Espera *${segundos} segundos* antes de pedir otra canción o poema.`
      }, { quoted: msg });
    }

    cooldowns.set(sender, ahora);

    // Detectar si es poema o canción
    const esPoema = cmd.includes("poema") || cmd.includes("poem");
    const tipo = esPoema ? "poema" : "canción";
    const emoji = esPoema ? "📜" : "🎵";

    await sock.sendMessage(jid, {
      text: `${emoji} *Creando ${tipo}...*\n\n📝 Tema: _${input}_\n\n⏳ Dame un momento...`
    }, { quoted: msg });

    try {
      await sock.sendPresenceUpdate("composing", jid);

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Crea un ${tipo} sobre: ${input}` }
        ],
        max_tokens: 500,
        temperature: 1.0, // más creatividad
      });

      const resultado = completion.choices[0]?.message?.content;
      if (!resultado) throw new Error("Respuesta vacía");

      await sock.sendPresenceUpdate("paused", jid);
      await sock.sendMessage(jid, {
        text: `${emoji} *${tipo.charAt(0).toUpperCase() + tipo.slice(1)} generado por IA*\n\n📝 _${input}_\n\n${"─".repeat(30)}\n\n${resultado}\n\n${"─".repeat(30)}\n🤖 Creado por Valentina IA`
      }, { quoted: msg });

    } catch (e) {
      console.error("[CANCION ERROR]", e.message);
      cooldowns.delete(sender);
      await sock.sendPresenceUpdate("paused", jid);
      await sock.sendMessage(jid, {
        text: `❌ No pude crear el ${tipo}. Intenta de nuevo en un momento.`
      }, { quoted: msg });
    }
  },
};