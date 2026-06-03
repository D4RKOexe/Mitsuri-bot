import os from "os";
import { reply } from "../../utils.js";

const START_TIME = Date.now();

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
  if (bytes >= 1073741824)
    return `${(bytes / 1073741824).toFixed(2)} GB`;

  if (bytes >= 1048576)
    return `${(bytes / 1048576).toFixed(2)} MB`;

  if (bytes >= 1024)
    return `${(bytes / 1024).toFixed(2)} KB`;

  return `${bytes} B`;
}

export default {
  name: "stats",
  aliases: ["botinfo", "sistema"],

  run: async (sock, msg, args, jid, isOwner) => {

    if (!isOwner) {
      return reply(
        sock,
        jid,
        "❌ Solo el dueño puede usar este comando.",
        msg
      );
    }

    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;

    const memPct = (
      (memUsed / memTotal) * 100
    ).toFixed(1);

    const cpus = os.cpus();

    const cpuModel =
      cpus[0]?.model?.trim() ||
      "Desconocido";

    const cpuCores = cpus.length;

    const procMem = process.memoryUsage();

    const uptime = formatUptime(
      Date.now() - START_TIME
    );

    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    const nodeVer = process.version;

    const load = os.loadavg();

    let estado = "🩷 ÓPTIMO";

    if (memPct > 60)
      estado = "💛 NORMAL";

    if (memPct > 80)
      estado = "❤️ ALTO CONSUMO";

    const barras = Math.round(memPct / 10);

    const barra =
      "█".repeat(barras) +
      "░".repeat(10 - barras);

    const texto =
`┏━━━°❀•°:🌸:°•❀°━━━┓

      🌸 MITSURI SYSTEM

⏱️ Uptime
» ${uptime}

🌐 Host
» ${hostname}

🖥️ Sistema
» ${platform} ${arch}

⚙️ Node.js
» ${nodeVer}

━━━━━━━━━━━━━━━━━━

🧠 RAM VPS
» ${formatBytes(memUsed)} / ${formatBytes(memTotal)}

📊 Uso RAM
» ${barra}
» ${memPct}%

📉 Libre
» ${formatBytes(memFree)}

━━━━━━━━━━━━━━━━━━

⚡ CPU
» ${cpuModel}

🔢 Núcleos
» ${cpuCores}

📈 Carga
» ${load[0].toFixed(2)} | ${load[1].toFixed(2)} | ${load[2].toFixed(2)}

━━━━━━━━━━━━━━━━━━

📦 Heap Usado
» ${formatBytes(procMem.heapUsed)}

📦 Heap Total
» ${formatBytes(procMem.heapTotal)}

📦 RSS
» ${formatBytes(procMem.rss)}

━━━━━━━━━━━━━━━━━━

🩷 Estado
» ${estado}

🤖 Mitsuri Bot
» ONLINE

┗━━━°❀•°:🌸:°•❀°━━━┛`;

    await reply(
      sock,
      jid,
      texto,
      msg
    );
  }
};