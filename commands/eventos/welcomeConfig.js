import fs from "fs-extra";

const CONFIG_PATH = "./data/welcomeConfig.json";

async function loadConfig() {
  try {
    return await fs.readJson(CONFIG_PATH);
  } catch {
    return { disabled: [] };
  }
}

async function saveConfig(config) {
  await fs.ensureDir("./data");
  await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
}

export async function isWelcomeDisabled(groupJid) {
  const config = await loadConfig();
  return config.disabled.includes(groupJid);
}

export async function disableWelcome(groupJid) {
  const config = await loadConfig();
  if (!config.disabled.includes(groupJid)) {
    config.disabled.push(groupJid);
    await saveConfig(config);
  }
}

export async function enableWelcome(groupJid) {
  const config = await loadConfig();
  config.disabled = config.disabled.filter((jid) => jid !== groupJid);
  await saveConfig(config);
}