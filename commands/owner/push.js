import { execSync } from "child_process";
import { reply } from "../../utils.js";

const BOT_DIR = process.cwd();

function git(cmd) {
  return execSync(`git -C "${BOT_DIR}" ${cmd}`, { stdio: "pipe" })
    .toString()
    .trim();
}

export default {
  name: "push",
  aliases: ["gitpush", "subir"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) {
      return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);
    }

    try {
      await reply(sock, jid, "⏳ *Subiendo cambios a GitHub...*", msg);

      const commitMsg = args.join(" ").trim() || "update";

      // Info antes del push
      const branch    = git("rev-parse --abbrev-ref HEAD");
      const remote    = git("remote get-url origin");

      // Contar archivos modificados
      const statusRaw = git("status --short");
      const archivos  = statusRaw ? statusRaw.split("\n").filter(Boolean) : [];

      // Hacer el push
      git("add .");
      
      let commitHash = "";
      try {
        git(`commit -m "${commitMsg}"`);
        commitHash = git("rev-parse --short HEAD");
      } catch {
        // Si no hay nada que commitear
        await reply(sock, jid,
          `╭━━━〔 ⚠️ PUSH 〕━━━⬣\n` +
          `┃ No hay cambios nuevos para subir.\n` +
          `┃ 🌿 *Rama:* ${branch}\n` +
          `╰━━━━━━━━━━━━━━━━⬣`,
          msg
        );
        return;
      }

      git("push");

      // Info después del push
      const logRaw  = git("log --oneline -5");
      const commits = logRaw.split("\n").filter(Boolean);

      const listaArchivos = archivos.length
        ? archivos.map(f => `┃  ${f}`).join("\n")
        : "┃  Sin archivos modificados";

      const listaCommits = commits
        .map((c, i) => `┃  ${i === 0 ? "🟢" : "⚪"} ${c}`)
        .join("\n");

      try { await sock.sendMessage(jid, { react: { text: "✅", key: msg.key } }); } catch {}

      await reply(sock, jid,
        `╭━━━〔 ✅ PUSH EXITOSO 〕━━━⬣\n` +
        `┃\n` +
        `┃ 📝 *Commit:* ${commitMsg}\n` +
        `┃ 🔑 *Hash:* ${commitHash}\n` +
        `┃ 🌿 *Rama:* ${branch}\n` +
        `┃ 🌐 *Repo:* ${remote}\n` +
        `┃\n` +
        `┃ 📦 *Archivos subidos (${archivos.length}):*\n` +
        `${listaArchivos}\n` +
        `┃\n` +
        `┃ 🕓 *Últimos commits:*\n` +
        `${listaCommits}\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
        msg
      );

    } catch (e) {
      try { await sock.sendMessage(jid, { react: { text: "❌", key: msg.key } }); } catch {}
      const reason = e.stderr?.toString() || e.message;
      await reply(sock, jid,
        `╭━━━〔 ❌ ERROR EN PUSH 〕━━━⬣\n` +
        `┃ ${reason}\n` +
        `╰━━━━━━━━━━━━━━━━⬣`,
        msg
      );
    }
  },
};