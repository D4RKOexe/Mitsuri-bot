import os from "os";

export default {
  name: "ping",
  aliases: ["latencia"],

  async run(sock, msg, args, jid) {

    const inicio = process.hrtime();

    const diff = process.hrtime(inicio);

    const ms = (
      diff[0] * 1000 +
      diff[1] / 1e6
    ).toFixed(2);

    const uptime = process.uptime();

    const dias = Math.floor(uptime / 86400);
    const horas = Math.floor((uptime % 86400) / 3600);
    const minutos = Math.floor((uptime % 3600) / 60);

    const ramUsada = (
      process.memoryUsage().rss /
      1024 /
      1024
    ).toFixed(0);

    let estado = "🩷 PERFECTO";

    if (ms > 100) estado = "💛 BUENO";
    if (ms > 300) estado = "🧡 REGULAR";
    if (ms > 600) estado = "❤️ LENTO";

    await sock.sendMessage(jid, {
      text:
`┏━━━°❀•°:🌸:°•❀°━━━┓

       ⚡ MITSURI CORE ⚡

🏓 Ping        » ${ms} ms
🧠 RAM         » ${ramUsada} MB
⚙️ Node.js     » ${process.version}
💻 Sistema     » ${os.platform()} ${os.arch()}
⏱️ Online      » ${dias}d ${horas}h ${minutos}m

🩷 Estado      » ${estado}
✨ Rendimiento » ÓPTIMO

┗━━━°❀•°:🌸:°•❀°━━━┛`
    }, {
      quoted: msg
    });

  }
};