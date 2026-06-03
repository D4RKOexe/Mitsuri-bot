import { execSync } from "child_process";
import { reply } from "../../utils.js";

const BOT_DIR = process.cwd();

function run(cmd) {
  return execSync(cmd, {
    cwd: BOT_DIR,
    encoding: "utf8"
  }).trim();
}

export default {
  name: "update",
  aliases: ["actualizar", "up"],

  async run(sock, msg, args, jid, isOwner) {

    if (!isOwner) {
      return reply(
        sock,
        jid,
        "❌ Solo el owner puede usar este comando.",
        msg
      );
    }

    try {

      const inicio = Date.now();

      await reply(
        sock,
        jid,
        "🔄 Buscando actualizaciones...",
        msg
      );

      const branch = run("git rev-parse --abbrev-ref HEAD");
      const oldCommit = run("git rev-parse --short HEAD");

      run("git fetch");

      const commits = run(
        "git rev-list HEAD..origin/main --count"
      );

      if (Number(commits) === 0) {

        return reply(
          sock,
          jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      🌸 MITSURI UPDATE

✅ Ya tienes la última versión

🌿 Rama        » ${branch}
🔖 Commit      » ${oldCommit}

💖 Todo está actualizado

┗━━━°❀•°:🌸:°•❀°━━━┛`,
          msg
        );
      }

      let cambios = "";

      try {
        cambios = run(
          "git log --oneline HEAD..origin/main -5"
        );
      } catch {
        cambios = "No disponible";
      }

      await reply(
        sock,
        jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      🔄 MITSURI UPDATE

🌿 Rama         » ${branch}
🔖 Versión      » ${oldCommit}

📥 Actualizaciones
» ${commits}

━━━━━━━━━━━━━━━━━━

📝 Últimos cambios

${cambios}

━━━━━━━━━━━━━━━━━━

⬇️ Descargando...

┗━━━°❀•°:🌸:°•❀°━━━┛`,
        msg
      );

      run("git pull");
      run("npm install");

      const newCommit = run(
        "git rev-parse --short HEAD"
      );

      const tiempo = (
        (Date.now() - inicio) / 1000
      ).toFixed(2);

      try {
        await sock.sendMessage(jid, {
          react: {
            text: "🚀",
            key: msg.key
          }
        });
      } catch {}

      await reply(
        sock,
        jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      ✅ UPDATE COMPLETO

🔖 Antes » ${oldCommit}
🔖 Ahora » ${newCommit}

⏱️ Tiempo
» ${tiempo}s

📦 Dependencias
» Actualizadas

♻️ Reiniciando bot...

┗━━━°❀•°:🌸:°•❀°━━━┛`,
        msg
      );

      process.exit(0);

    } catch (e) {

      return reply(
        sock,
        jid,
`┏━━━°❀•°:🌸:°•❀°━━━┓

      ❌ UPDATE ERROR

${e.message}

┗━━━°❀•°:🌸:°•❀°━━━┛`,
        msg
      );
    }
  }
};