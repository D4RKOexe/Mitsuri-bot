import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { getSender } from '../utilidades/permisos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '../../');

const OWNER_NUMBER = "573223090406";

const command = {
  name: 'file',
  aliases: ['fs', 'explorar'],
  run: async (sock, msg, args, jid, isOwner) => {
    if (!isOwner) return; // ← usa el boolean directamente

    const subCommand = args[0]?.toLowerCase();
    const targetPath = args.slice(1).join(' ');
    const fullPath = path.join(ROOT_DIR, targetPath);

    try {
      if (subCommand === 'ls') {
        if (!fs.existsSync(fullPath)) return sock.sendMessage(jid, { text: "❌ Ruta no existe." });
        const files = fs.readdirSync(fullPath);
        let list = `📁 *Directorio:* /${targetPath}\n\n`;
        files.forEach(f => {
          const stat = fs.statSync(path.join(fullPath, f));
          list += `${stat.isDirectory() ? '📂' : '📄'} ${f}\n`;
        });
        return sock.sendMessage(jid, { text: list });
      }

      if (subCommand === 'get') {
        if (!fs.existsSync(fullPath)) return sock.sendMessage(jid, { text: "❌ El archivo o carpeta no existe." });
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          await sock.sendMessage(jid, { text: `📦 Comprimiendo carpeta: *${targetPath}*...` });
          const zipPath = path.join(ROOT_DIR, `temp_${Date.now()}.zip`);
          const output = fs.createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          await new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(fullPath, false);
            archive.finalize();
          });

          await sock.sendMessage(jid, {
            document: fs.readFileSync(zipPath),
            fileName: `${path.basename(fullPath)}.zip`,
            mimetype: 'application/zip'
          }, { quoted: msg });

          return fs.unlinkSync(zipPath);
        }

        return sock.sendMessage(jid, {
          document: fs.readFileSync(fullPath),
          fileName: path.basename(fullPath),
          mimetype: 'application/octet-stream'
        }, { quoted: msg });
      }

      if (subCommand === 'save') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return sock.sendMessage(jid, { text: "⚠️ Responde a un archivo." });
        const type = Object.keys(quoted).find(k => k.includes('Message') && !k.includes('protocol'));
        const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const finalName = targetPath || quoted[type].fileName || `file_${Date.now()}`;
        const savePath = path.join(ROOT_DIR, finalName);
        fs.mkdirSync(path.dirname(savePath), { recursive: true });
        fs.writeFileSync(savePath, buffer);
        return sock.sendMessage(jid, { text: `✅ Guardado en: /${finalName}` });
      }

      return sock.sendMessage(jid, { text: "🛠 *FILE MANAGER*\n\n• `.file ls [ruta]`\n• `.file get [ruta]`\n• `.file save [ruta]`" });

    } catch (err) {
      return sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
    }
  }
};

export default command;