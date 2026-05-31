import os from "os";
import { reply } from "../../utils.js";

const START_TIME = Date.now();

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export default {
  name: "stats",
  aliases: ["botinfo", "sistema"],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return reply(sock, jid, "❌ Solo el dueño puede usar este comando.", msg);

    const memTotal = os.totalmem();
    const memFree  = os.freemem();
    const memUsed  = memTotal - memFree;
    const memPct   = ((memUsed / memTotal) * 100).toFixed(1);

    const cpus     = os.cpus();
    const cpuModel = cpus[0]?.model?.trim() || "Desconocido";
    const cpuCores = cpus.length;

    const procMem  = process.memoryUsage();
    const uptime   = formatUptime(Date.now() - START_TIME);
    const platform = os.platform();
    const nodeVer  = process.version;

    const texto =
      `╭━━━〔 📊 STATS DEL BOT 〕━━━⬣\n` +
      `┃\n` +
      `┃ ⏱️ *Uptime:* ${uptime}\n` +
      `┃ 🖥️ *OS:* ${platform}\n` +
      `┃ 🟢 *Node:* ${nodeVer}\n` +
      `┃\n` +
      `┃ 🧠 *RAM Total:* ${formatBytes(memTotal)}\n` +
      `┃ 📈 *RAM Usada:* ${formatBytes(memUsed)} (${memPct}%)\n` +
      `┃ 📉 *RAM Libre:* ${formatBytes(memFree)}\n` +
      `┃\n` +
      `┃ ⚙️ *CPU:* ${cpuModel}\n` +
      `┃ 🔢 *Núcleos:* ${cpuCores}\n` +
      `┃\n` +
      `┃ 📦 *Heap usado:* ${formatBytes(procMem.heapUsed)}\n` +
      `┃ 📦 *Heap total:* ${formatBytes(procMem.heapTotal)}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`;

    await reply(sock, jid, texto, msg);
  },
};