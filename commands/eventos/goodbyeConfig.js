import fs from "fs-extra";

const CONFIG_PATH = "./data/goodbyeConfig.json";

async function loadConfig() {
  try {
    return await fs.readJson(CONFIG_PATH);
  } catch {
    return { enabled: [] }; // por defecto apagado
  }
}

async function saveConfig(config) {
  await fs.ensureDir("./data");
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function isGoodbyeEnabled(groupJid) {
  const config = await loadConfig();
  return config.enabled.includes(groupJid);
}

export async function enableGoodbye(groupJid) {
  const config = await loadConfig();
  if (!config.enabled.includes(groupJid)) {
    config.enabled.push(groupJid);
    await saveConfig(config);
  }
}

export async function disableGoodbye(groupJid) {
  const config = await loadConfig();
  config.enabled = config.enabled.filter((jid) => jid !== groupJid);
  await saveConfig(config);
}