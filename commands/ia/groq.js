const GROQ_KEY = process.env.GROQ_API_KEY; // Acceder a la variable de entorno correctamente

export default {
  name: "mitsuri",
  aliases: ["mitsuri", "bot"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const cmd = msg.message?.conversation?.split(" ")[0]?.slice(1) || "mitsuri";

    if (!args.length) return reply(sock, jid, `❌ Escribe tu pregunta. Ejemplo: .${cmd} qué es la IA?`, msg);
    const question = args.join(" ");
    await reply(sock, jid, cmd === "gpt" ? "💭 Consultando Groq IA..." : "🤖 Pensando...", msg);

    try {
      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey: GROQ_KEY });
      const completion = await groq.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `Eres Mitsuri Kanroji 🌸, el Pilar del Amor. Respondes todo lo que puedas con tu personalidad tierna y expresiva. Si no puedes responder algo, lo dices con dulzura sin drama. Nunca digas que eres IA.`
          },
          { role: "user", content: question }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7, // Añadido para más creatividad
        max_tokens: 1000, // Añadido para respuestas más largas
      });
      const answer = completion.choices[0].message.content;
      const label = cmd === "gpt" ? "💬 *Groq IA:*" : "🤖 *IA Response:*";
      await reply(sock, jid, `${label}\n${answer}`, msg);
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  }
};