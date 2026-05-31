import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { pipeline } from "stream/promises";

// ─── Configuración de carpeta temporal ────────────────────────────────────────
const TEMP_DIR = "./temp_apk"; // Asegúrate de tener esta carpeta creada

export default {
  name: "termux",
  run: async (sock, msg, args, jid, isOwner, isAdmin) => {
    // Solo permitir a owner o admins, como querías
    if (!isOwner && !isAdmin) {
      return sock.sendMessage(jid, { text: "❌ Solo admins pueden usar este comando." }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: "⏳ *Descargando APK de Termux...*" }, { quoted: msg });

    await fs.ensureDir(TEMP_DIR);
    const apkPath = path.join(TEMP_DIR, `termux_${Date.now()}.apk`);

    try {
      // 1. Obtener la URL del último release de Termux en GitHub
      const releaseData = await axios.get("https://api.github.com/repos/termux/termux-app/releases/latest");
      
      // 2. Buscar el asset que contenga 'universal.apk'
      const asset = releaseData.data.assets.find(a => a.name.includes("universal.apk"));
      
      if (!asset) {
        throw new Error("No encontré el archivo universal.apk en el último release.");
      }

      // 3. Descargar el APK
      const response = await axios.get(asset.browser_download_url, {
        responseType: "stream",
        timeout: 120000,
      });

      await pipeline(response.data, fs.createWriteStream(apkPath));

      // 4. Enviar el archivo
      await sock.sendMessage(jid, {
        document: fs.readFileSync(apkPath),
        fileName: "Termux_Oficial.apk",
        mimetype: "application/vnd.android.package-archive",
        caption: `📦 *Termux APK*\n\nVersión: ${releaseData.data.tag_name}\nFuente: GitHub Oficial`,
      }, { quoted: msg });

    } catch (e) {
      console.error("[TERMUX ERROR]", e);
      await sock.sendMessage(jid, { text: "❌ Error al obtener el APK oficial. Intenta de nuevo más tarde." }, { quoted: msg });
    } finally {
      // Limpiar archivo temporal
      if (await fs.pathExists(apkPath)) await fs.unlink(apkPath);
    }
  },
};