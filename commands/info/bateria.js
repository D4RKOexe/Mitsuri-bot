import si from "systeminformation";

export default {
  name: "bateria",
  aliases: ["carga", "battery"],
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");

    try {
      const bat = await si.battery();

      if (!bat.hasBattery) {
        return await reply(
          sock,
          jid,
          "🖥️ Este equipo no tiene batería detectada.\nProbablemente el bot está en un PC de escritorio.",
          msg
        );
      }

      let texto = "🔋 *Estado de la batería del PC*\n\n";
      texto += `• Porcentaje: ${bat.percent ?? "Desconocido"}%\n`;
      texto += `• Cargando: ${bat.isCharging ? "Sí" : "No"}\n`;
      texto += `• Corriente conectada: ${bat.acConnected ? "Sí" : "No"}\n`;

      if (bat.timeRemaining && bat.timeRemaining > 0) {
        const horas = Math.floor(bat.timeRemaining / 60);
        const minutos = bat.timeRemaining % 60;
        texto += `• Tiempo restante: ${horas}h ${minutos}m\n`;
      } else {
        texto += "• Tiempo restante: No disponible\n";
      }

      if ((bat.percent ?? 0) <= 20 && !bat.isCharging) {
        texto += "\n⚠️ Batería baja y el PC no está cargando.";
      } else if (bat.isCharging || bat.acConnected) {
        texto += "\n✅ El PC está conectado o cargando.";
      }

      await reply(sock, jid, texto, msg);
    } catch (e) {
      console.error("Error en bateria:", e);
      await reply(sock, jid, `❌ Error leyendo batería: ${e.message}`, msg);
    }
  },
};