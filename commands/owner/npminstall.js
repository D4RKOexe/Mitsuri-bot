import { execSync } from "child_process";
import { reply } from "../../utils.js";

const BOT_DIR = process.cwd();

export default {
  name: "npminstall",
  aliases: ["install", "npmi"],

  async run(sock, msg, args, jid, isOwner) {
    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el owner puede usar este comando.", msg);
    }

    const paquete = args[0];
    if (!paquete) {
      return reply(sock, jid,
        "❌ Especifica un paquete.\n\n📌 Ejemplo: *.npminstall cheerio*",
        msg
      );
    }

    await reply(sock, jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      📦 NPM INSTALL

⏳ Instalando: *${paquete}*
⏳ Espera un momento...

┗━━━°❀•°:🌸:°•❀°━━━┛`, msg);

    try {
      const resultado = execSync(`npm install ${paquete}`, {
        cwd: BOT_DIR,
        encoding: "utf8",
        timeout: 60000,
      }).trim();

      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      return reply(sock, jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      ✅ INSTALADO

📦 Paquete » ${paquete}

📋 Resultado
» ${resultado.slice(0, 300)}

┗━━━°❀•°:🌸:°•❀°━━━┛`, msg);

    } catch (e) {
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}

      return reply(sock, jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      ❌ ERROR

📦 Paquete » ${paquete}

${e.message.slice(0, 300)}

┗━━━°❀•°:🌸:°•❀°━━━┛`, msg);
    }
  }
};