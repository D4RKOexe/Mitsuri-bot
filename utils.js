import fs from "fs-extra";

const GRUPOS_PATH = "./data/grupos_permitidos.json";

export const reply = async (sock, jid, text, quoted) => {
  if (!text || !text.trim()) return;
  const mensaje = `*𝘮𝘪𝘵𝘴𝘶𝘳𝘪 𝘣𝘰𝘵❤️* ${text}`;
  await sock.sendMessage(jid, { text: mensaje }, { quoted });
};

export const sendImage = async (sock, jid, buffer, caption = "", quoted) => {
  await sock.sendMessage(jid, { image: buffer, caption }, { quoted });
};

export const sendAudio = async (sock, jid, buffer, quoted) => {
  await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4", ptt: false }, { quoted });
};

export const sendVoiceNote = async (sock, jid, buffer, quoted) => {
  await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted });
};

export const sendVideo = async (sock, jid, buffer, caption = "", quoted) => {
  await sock.sendMessage(jid, { video: buffer, caption }, { quoted });
};

export const sendSticker = async (sock, jid, buffer, quoted) => {
  await sock.sendMessage(jid, { sticker: buffer }, { quoted });
};

// ─── Reacción con emoji ────────────────────────────────────────────────────────
export const react = async (sock, msg, emoji) => {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  } catch (e) {
    console.error("[REACT ERROR]", e.message);
  }
};

// ─── Control de grupos permitidos ─────────────────────────────────────────────
export async function getGruposPermitidos() {
  await fs.ensureDir("./data");
  if (!await fs.pathExists(GRUPOS_PATH)) {
    await fs.writeJson(GRUPOS_PATH, []);
  }
  return fs.readJson(GRUPOS_PATH);
}

export async function permitirGrupo(jid) {
  const grupos = await getGruposPermitidos();
  if (!grupos.includes(jid)) {
    grupos.push(jid);
    await fs.writeJson(GRUPOS_PATH, grupos, { spaces: 2 });
  }
}

export async function quitarGrupo(jid) {
  const grupos = await getGruposPermitidos();
  const nuevos = grupos.filter(g => g !== jid);
  await fs.writeJson(GRUPOS_PATH, nuevos, { spaces: 2 });
}

export async function grupoPermitido(jid) {
  // Chats privados siempre permitidos
  if (!jid.endsWith("@g.us")) return true;
  const grupos = await getGruposPermitidos();
  return grupos.includes(jid);
}