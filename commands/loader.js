import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carpetas que solo funcionan en grupos
const SOLO_GRUPOS = ["economia"];

function wrapSoloGrupo(run) {
  return async (sock, msg, args, chatId, isOwner, isGroup, sender) => {
    if (!isGroup) {
      return sock.sendMessage(chatId, {
        text: "🌸 Este comando solo se puede usar en grupos 💕"
      }, { quoted: msg });
    }
    return run(sock, msg, args, chatId, isOwner, isGroup, sender);
  };
}

async function loadCommands() {
  const commands = {};
  const folders = readdirSync(__dirname).filter((f) =>
    statSync(join(__dirname, f)).isDirectory()
  );

  for (const folder of folders) {
    const esGrupo = SOLO_GRUPOS.includes(folder);

    const files = readdirSync(join(__dirname, folder)).filter((f) =>
      f.endsWith(".js")
    );

    for (const file of files) {
      try {
        const filePath = pathToFileURL(join(__dirname, folder, file)).href;
        const mod = await import(filePath);

        // Cargar exports nombrados
        for (const key of Object.keys(mod)) {
          if (key === "default" || key === "antiLinkGroups") continue;

          const cmd = mod[key];
          if (cmd?.name && cmd?.run) {
            const run = esGrupo ? wrapSoloGrupo(cmd.run) : cmd.run;
            commands[cmd.name] = run;
            if (cmd.aliases) {
              cmd.aliases.forEach((a) => { commands[a] = run; });
            }
          }
        }

        // Cargar default
        const cmd = mod.default;
        if (cmd?.name && cmd?.run && !commands[cmd.name]) {
          const run = esGrupo ? wrapSoloGrupo(cmd.run) : cmd.run;
          commands[cmd.name] = run;
          if (cmd.aliases) {
            cmd.aliases.forEach((a) => {
              if (!commands[a]) commands[a] = run;
            });
          }
        }
      } catch (e) {
        console.error(`Error cargando ${folder}/${file}:`, e.message);
      }
    }
  }

  return commands;
}

export default loadCommands;