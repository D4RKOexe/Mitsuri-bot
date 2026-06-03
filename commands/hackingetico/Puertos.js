import { reply } from "../../utils.js";

const PUERTOS = {
  21:   { nombre: "FTP",         desc: "Transferencia de archivos",         riesgo: "🔴 Alto" },
  22:   { nombre: "SSH",         desc: "Acceso remoto seguro",              riesgo: "🟡 Medio" },
  23:   { nombre: "Telnet",      desc: "Acceso remoto sin cifrado",         riesgo: "🔴 Alto" },
  25:   { nombre: "SMTP",        desc: "Envío de correos",                  riesgo: "🟡 Medio" },
  53:   { nombre: "DNS",         desc: "Resolución de nombres de dominio",  riesgo: "🟢 Bajo" },
  80:   { nombre: "HTTP",        desc: "Web sin cifrado",                   riesgo: "🟡 Medio" },
  110:  { nombre: "POP3",        desc: "Recepción de correos",              riesgo: "🟡 Medio" },
  143:  { nombre: "IMAP",        desc: "Gestión de correos",                riesgo: "🟡 Medio" },
  443:  { nombre: "HTTPS",       desc: "Web cifrada SSL/TLS",               riesgo: "🟢 Bajo" },
  445:  { nombre: "SMB",         desc: "Compartir archivos Windows",        riesgo: "🔴 Alto" },
  1433: { nombre: "MSSQL",       desc: "Base de datos SQL Server",          riesgo: "🔴 Alto" },
  3306: { nombre: "MySQL",       desc: "Base de datos MySQL",               riesgo: "🔴 Alto" },
  3389: { nombre: "RDP",         desc: "Escritorio remoto Windows",         riesgo: "🔴 Alto" },
  5432: { nombre: "PostgreSQL",  desc: "Base de datos PostgreSQL",          riesgo: "🔴 Alto" },
  5900: { nombre: "VNC",         desc: "Control remoto de escritorio",      riesgo: "🔴 Alto" },
  6379: { nombre: "Redis",       desc: "Base de datos en memoria",          riesgo: "🔴 Alto" },
  8080: { nombre: "HTTP-Alt",    desc: "Puerto alternativo web",            riesgo: "🟡 Medio" },
  8443: { nombre: "HTTPS-Alt",   desc: "Puerto alternativo HTTPS",          riesgo: "🟢 Bajo" },
  27017:{ nombre: "MongoDB",     desc: "Base de datos MongoDB",             riesgo: "🔴 Alto" },
};

export default {
  name: "puerto",
  aliases: ["puertos", "port", "portinfo"],
  description: "Info sobre un puerto de red",

  run: async (sock, msg, args, jid) => {
    const react = async (e) => { try { await sock.sendMessage(jid, { react: { text: e, key: msg.key } }); } catch {} };

    const num = parseInt(args[0]);

    // Sin argumento → mostrar lista
    if (!args[0]) {
      let lista = `🔌 *Puertos comunes*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const [p, info] of Object.entries(PUERTOS)) {
        lista += `*${p}* — ${info.nombre} ${info.riesgo}\n`;
      }
      lista += `\n💡 Usa _.puerto <número>_ para más detalles`;
      await react("✅");
      return reply(sock, jid, lista, msg);
    }

    if (isNaN(num) || num < 1 || num > 65535) {
      await react("❌");
      return reply(sock, jid, "❌ Puerto inválido. Rango: 1-65535", msg);
    }

    const info = PUERTOS[num];

    if (!info) {
      await react("✅");
      return reply(sock, jid,
        `🔌 *Puerto ${num}*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `ℹ️ Puerto no registrado en la base de datos.\n` +
        `Puede ser un puerto personalizado o poco común.`,
        msg
      );
    }

    await react("✅");
    return reply(sock, jid,
      `🔌 *Puerto ${num} — ${info.nombre}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Servicio:* ${info.nombre}\n` +
      `📝 *Descripción:* ${info.desc}\n` +
      `⚠️ *Riesgo:* ${info.riesgo}`,
      msg
    );
  },
};