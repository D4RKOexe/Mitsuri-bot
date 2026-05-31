import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadCommands() {
  const commands = {};
  const folders = readdirSync(__dirname).filter((f) =>
    statSync(join(__dirname, f)).isDirectory()
  );

  for (const folder of folders) {
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
            commands[cmd.name] = cmd.run;
            if (cmd.aliases) {
              cmd.aliases.forEach((a) => {
                commands[a] = cmd.run;
              });
            }
          }
        }

        // Cargar default
        const cmd = mod.default;
        if (cmd?.name && cmd?.run && !commands[cmd.name]) {
          commands[cmd.name] = cmd.run;
          if (cmd.aliases) {
            cmd.aliases.forEach((a) => {
              if (!commands[a]) commands[a] = cmd.run;
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