import { exec } from "child_process";
import { reply } from "../../utils.js";

const BOT_DIR = process.cwd();

export default {
  name: "shell",
  aliases: ["terminal", "run", "bash"],

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el owner puede usar este comando.", msg);
    }

    const comando = args.join(" ").trim();

    if (!comando) {
      return reply(sock, jid,
        "💻 *Terminal*\n\n" +
        "Uso: `.term <comando>`\n\n" +
        "Ejemplos:\n" +
        "• `.term pip install yt-dlp`\n" +
        "• `.term apt install ffmpeg -y`\n" +
        "• `.term npm install axios`\n" +
        "• `.term ls -la`\n" +
        "• `.term pm2 list`",
        msg
      );
    }

    await reply(sock, jid, `💻 Ejecutando:\n\`${comando}\``, msg);

    exec(comando, {
      cwd: BOT_DIR,
      timeout: 120_000,
      env: { ...process.env, DEBIAN_FRONTEND: "noninteractive" },
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    }, async (error, stdout, stderr) => {
      const salida   = (stdout || "").trim();
      const errSalida = (stderr || "").trim();

      // Combinar stdout y stderr
      let resultado = "";
      if (salida)    resultado += salida;
      if (errSalida) resultado += (salida ? "\n\n⚠️ stderr:\n" : "") + errSalida;
      if (!resultado) resultado = "(sin salida)";

      // Truncar si es muy largo
      if (resultado.length > 3000) {
        resultado = "..." + resultado.slice(-3000);
      }

      const emoji = error ? "❌" : "✅";
      try { await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }); } catch {}

      return reply(sock, jid,
`💻 *Terminal*
━━━━━━━━━━━━━━━━━━━
📌 Cmd: \`${comando}\`
${error ? `❌ Código: ${error.code ?? "error"}` : "✅ Exitoso"}
━━━━━━━━━━━━━━━━━━━
\`\`\`
${resultado}
\`\`\``,
        msg
      );
    });
  }
};