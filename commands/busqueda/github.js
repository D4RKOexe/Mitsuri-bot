import axios from "axios";
import { reply } from "../../utils.js";

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return "Desconocida";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

function getLangEmoji(lang) {
  const map = {
    JavaScript: "🟨", TypeScript: "🔷", Python: "🐍", Java: "☕",
    "C++": "⚙️", C: "🔧", "C#": "💜", PHP: "🐘", Ruby: "💎",
    Go: "🐹", Rust: "🦀", Swift: "🍎", Kotlin: "🟣", Dart: "🎯",
    HTML: "🌐", CSS: "🎨", Shell: "🖥️", Vue: "💚", Svelte: "🔥",
  };
  return map[lang] || "📦";
}

async function buscarUsuario(sock, msg, jid, username) {
  const { data: user } = await axios.get(
    `https://api.github.com/users/${username}`,
    { headers: { "User-Agent": "WhatsApp-Bot" }, timeout: 10000 }
  );

  const { data: repos } = await axios.get(
    `https://api.github.com/users/${username}/repos?sort=stars&per_page=3`,
    { headers: { "User-Agent": "WhatsApp-Bot" }, timeout: 10000 }
  );

  const topRepos = repos
    .slice(0, 3)
    .map(r => `┃   ⭐ ${formatNumber(r.stargazers_count)} · ${r.name}`)
    .join("\n");

  const texto =
    `╭━━━〔 🐙 GITHUB USUARIO 〕━━━⬣\n` +
    `┃\n` +
    `┃ 👤 *${user.name || user.login}*\n` +
    `┃ 🔗 @${user.login}\n` +
    (user.bio ? `┃ 📝 ${user.bio}\n` : "") +
    (user.location ? `┃ 📍 ${user.location}\n` : "") +
    (user.company ? `┃ 🏢 ${user.company}\n` : "") +
    `┃\n` +
    `┃ 📦 *Repos públicos:* ${user.public_repos}\n` +
    `┃ 👥 *Seguidores:* ${formatNumber(user.followers)}\n` +
    `┃ 👣 *Siguiendo:* ${formatNumber(user.following)}\n` +
    `┃\n` +
    `┃ 🏆 *Top repos:*\n` +
    topRepos + "\n" +
    `┃\n` +
    `┃ 📅 *Miembro desde:* ${formatDate(user.created_at)}\n` +
    `┃ 🌐 github.com/${user.login}\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━⬣`;

  await reply(sock, jid, texto, msg);
}

async function buscarRepo(sock, msg, jid, input) {
  // input puede ser "usuario/repo" o solo "repo"
  const { data: results } = await axios.get(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(input)}&sort=stars&per_page=1`,
    { headers: { "User-Agent": "WhatsApp-Bot" }, timeout: 10000 }
  );

  if (!results.items.length) {
    return reply(sock, jid, `❌ No encontré ningún repositorio con *${input}*.`, msg);
  }

  const r = results.items[0];
  const langEmoji = getLangEmoji(r.language);

  const texto =
    `╭━━━〔 📁 GITHUB REPO 〕━━━⬣\n` +
    `┃\n` +
    `┃ 📦 *${r.full_name}*\n` +
    (r.description ? `┃ 📝 ${r.description}\n` : "") +
    `┃\n` +
    `┃ ⭐ *Stars:* ${formatNumber(r.stargazers_count)}\n` +
    `┃ 🍴 *Forks:* ${formatNumber(r.forks_count)}\n` +
    `┃ 👁️ *Watchers:* ${formatNumber(r.watchers_count)}\n` +
    `┃ 🐛 *Issues abiertos:* ${r.open_issues_count}\n` +
    `┃\n` +
    `┃ ${langEmoji} *Lenguaje:* ${r.language || "No especificado"}\n` +
    `┃ 📜 *Licencia:* ${r.license?.name || "Sin licencia"}\n` +
    `┃ 🔒 *Privado:* ${r.private ? "Sí" : "No"}\n` +
    `┃\n` +
    `┃ 📅 *Creado:* ${formatDate(r.created_at)}\n` +
    `┃ 🔄 *Actualizado:* ${formatDate(r.updated_at)}\n` +
    `┃\n` +
    `┃ 🌐 ${r.html_url}\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━⬣`;

  await reply(sock, jid, texto, msg);
}

export default {
  name: "github",
  aliases: ["gh", "git"],
  description: "Busca usuarios o repositorios de GitHub",
  usage: ".github <usuario> | .github repo <nombre>",

  run: async (sock, msg, args, jid) => {
    if (!args.length) {
      return reply(
        sock, jid,
        `❌ Uso correcto:\n` +
        `👤 *.github <usuario>* — Info de un usuario\n` +
        `📁 *.github repo <nombre>* — Buscar un repositorio\n\n` +
        `📌 Ejemplos:\n` +
        `   *.github torvalds*\n` +
        `   *.github repo express*`,
        msg
      );
    }

    try {
      await reply(sock, jid, `🔍 *Buscando en GitHub...*`, msg);

      if (args[0].toLowerCase() === "repo") {
        const query = args.slice(1).join(" ").trim();
        if (!query) {
          return reply(sock, jid, "❌ Escribe el nombre del repo.\n📌 Ejemplo: *.github repo express*", msg);
        }
        await buscarRepo(sock, msg, jid, query);
      } else {
        await buscarUsuario(sock, msg, jid, args[0]);
      }

    } catch (e) {
      console.error("[GITHUB ERROR]", e.message);

      if (e.response?.status === 404) {
        return reply(sock, jid, `❌ No encontré a *${args[0]}* en GitHub.`, msg);
      }
      if (e.response?.status === 403) {
        return reply(sock, jid, `⚠️ Límite de la API de GitHub alcanzado. Intenta en unos minutos.`, msg);
      }

      await reply(sock, jid, `❌ Error al consultar GitHub. Intenta de nuevo.`, msg);
    }
  },
};