import fs from "fs-extra";
import path from "path";
import { reply } from "../../utils.js";

const audiosDir = "C:\\Users\\Draven\\Desktop\\MiBot\\audios-fix";

export default {
  name: "audio",
  run: async (sock, msg, args, jid) => {
    try {
      console.log("🎙️ Buscando en:", audiosDir);

      if (!fs.existsSync(audiosDir)) {
        await fs.mkdir(audiosDir, { recursive: true });
        return reply(sock, jid, "📁 Carpeta audios-fix creada", msg);
      }

      const files = fs
        .readdirSync(audiosDir)
        .filter(f => f.toLowerCase().endsWith(".ogg"))
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

      if (!files.length) {
        return reply(sock, jid, "📁 No hay audios .ogg en la carpeta", msg);
      }

      if (!args.length) {
        const lista = files
          .map((f, i) => `${i + 1}. ${f.replace(/\.ogg$/i, "").replace(/_fixed$/i, "")}`)
          .join("\n");

        return reply(
          sock,
          jid,
          `🎙️ *LISTA DE AUDIOS* (${files.length})\n\n${lista}`,
          msg
        );
      }

      const consulta = args.join(" ").trim();
      let archivoSeleccionado;

      if (/^\d+$/.test(consulta)) {
        const index = parseInt(consulta, 10) - 1;

        if (index < 0 || index >= files.length) {
          return reply(
            sock,
            jid,
            `❌ Número inválido. Usa un número entre 1 y ${files.length}.`,
            msg
          );
        }

        archivoSeleccionado = files[index];
      } else {
        const buscado = consulta.toLowerCase();

        archivoSeleccionado = files.find(f => {
          const nombreBase = f
            .replace(/\.ogg$/i, "")
            .replace(/_fixed$/i, "")
            .toLowerCase();
          return nombreBase === buscado;
        });

        if (!archivoSeleccionado) {
          return reply(sock, jid, `❌ No existe el audio: ${consulta}`, msg);
        }
      }

      const archivoRuta = path.join(audiosDir, archivoSeleccionado);

      if (!fs.existsSync(archivoRuta)) {
        return reply(sock, jid, `❌ No se encontró el archivo: ${archivoSeleccionado}`, msg);
      }

      const buffer = fs.readFileSync(archivoRuta);

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        fileName: archivoSeleccionado
      });

    } catch (error) {
      console.error("❌ Error en comando audio:", error);
      return reply(sock, jid, `❌ Error en el comando: ${error.message}`, msg);
    }
  }
};