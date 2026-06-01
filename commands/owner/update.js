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

      await reply(
        sock,
        jid,
        "🔄 Buscando actualizaciones...",
        msg
      );

      run("git fetch");

      const commits = run(
        "git rev-list HEAD..origin/main --count"
      );

      if (Number(commits) === 0) {
        return reply(
          sock,
          jid,
          "✅ Ya tienes la última versión del bot.",
          msg
        );
      }

      await reply(
        sock,
        jid,
        `📥 Encontradas ${commits} actualización(es).\n\nActualizando...`,
        msg
      );

      run("git pull");
      run("npm install");

      await reply(
        sock,
        jid,
        "✅ Actualización completada.\n♻️ Reiniciando bot...",
        msg
      );

      process.exit(0);

    } catch (e) {

      return reply(
        sock,
        jid,
        `❌ Error:\n${e.message}`,
        msg
      );
    }
  }
};