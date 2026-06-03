export default {
  name: "mega",
  aliases: ["mg"],

  run: async (sock, msg, args, jid) => {
    await sock.sendMessage(jid, {
      text: "🔧 *Comando en mantenimiento, por falta de presupuesto XD*\n\n> _Estamos trabajando para mejorar este comando, vuelve pronto._"
    }, { quoted: msg });
  },
};