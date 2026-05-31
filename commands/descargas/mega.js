import axios from "axios";

const API_BASE = process.env.DV_API_URL;
const APIKEY   = process.env.DV_API_KEY;

export default {
  name: "mega",
  aliases: ["megadl", "megadescargar"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    const url = args.join("").trim();

    if (!url || !url.includes("mega.nz")) {
      return reply(sock, jid,
        "❌ Debes enviar un enlace de MEGA válido.\n📌 Ejemplo: *.mega https://mega.nz/file/xxx*",
        msg
      );
    }

    await reply(sock, jid, "⏳ *Procesando enlace de MEGA...*", msg);

    try {
      const { data } = await axios.get(`${API_BASE}/mega`, {
        params: { url, apikey: APIKEY },
        headers: { "x-api-key": APIKEY },
        timeout: 60000,
      });

      if (!data?.ok) throw new Error("La API no procesó el enlace.");

      const downloadUrl = data.download_url_full || data.stream_url_full;
      if (!downloadUrl) throw new Error("No se obtuvo URL de descarga.");

      const titulo    = data.title    || "Archivo";
      const filename  = data.filename || "archivo";
      const filesize  = data.filesize || "?";
      const format    = data.format   || data.extension?.toUpperCase() || "?";
      const expiresIn = data.expires_in_hint_seconds
        ? `${Math.floor(data.expires_in_hint_seconds / 60)} min`
        : "20 min";

      const texto =
        `📦 *Archivo MEGA listo*\n` +
        `${"─".repeat(30)}\n` +
        `📄 *Nombre:* ${titulo}\n` +
        `🗂️ *Archivo:* ${filename}\n` +
        `📊 *Tamaño:* ${filesize}\n` +
        `🔖 *Formato:* ${format}\n` +
        `⏱️ *Expira en:* ${expiresIn}\n` +
        `${"─".repeat(30)}\n` +
        `🔗 ${downloadUrl}`;

      await reply(sock, jid, texto, msg);

    } catch (e) {
      console.error("[MEGA ERROR]", e.message);
      const reason = e.response?.data?.message || e.message;
      await reply(sock, jid,
        `❌ No se pudo procesar el enlace de MEGA.\n🔎 *Razón:* ${reason}`,
        msg
      );
    }
  },
};