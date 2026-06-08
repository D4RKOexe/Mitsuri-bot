import gradient   from "gradient-string";
import chalk       from "chalk";
import figlet      from "figlet";
import boxen       from "boxen";
import { CONFIG }  from "./config.js";
import startBot    from "./index.js";   // tu lógica principal

// ─── Paletas (solo 2 colores por par, gradient-string lo exige) ──────────────
const rosa    = gradient(["#ff9a9e", "#fad0c4"]);
const purpura = gradient(["#a18cd1", "#fbc2eb"]);
const dorado  = gradient(["#f7971e", "#ffd200"]);
const cielo   = gradient(["#89f7fe", "#66a6ff"]);

// ─── Helpers de impresión ─────────────────────────────────────────────────────
const linea   = (c = "═", n = 60) => c.repeat(n);
const titulo  = (txt, color = rosa) => console.log(color(txt));
const separador = (color = rosa) => titulo(linea(), color);

function banner() {
  // ASCII art del nombre del bot
  const art = figlet.textSync(CONFIG.botName ?? "MI BOT", {
    font: "Small",
    horizontalLayout: "default",
  });

  const box = boxen(dorado(art), {
    padding: 1,
    borderStyle: "double",
    borderColor: "yellow",
    textAlignment: "center",
  });

  console.log(box);
}

function cabecera() {
  separador(purpura);
  titulo(`   ✨ ${CONFIG.botName} — Iniciando sistema ✨`, purpura);
  separador(purpura);
  console.log(rosa(`   「${CONFIG.frase ?? "Listo para ayudar"}」`));
  separador(purpura);
}

function progreso(paso, total, texto) {
  const llenado = Math.round((paso / total) * 20);
  const barra   = "█".repeat(llenado) + "░".repeat(20 - llenado);
  process.stdout.write(
    `\r  ${cielo(`[${barra}]`)} ${chalk.gray(`${paso}/${total}`)}  ${chalk.white(texto)}   `
  );
  if (paso === total) process.stdout.write("\n");
}

async function pausa(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Secuencia de arranque ────────────────────────────────────────────────────
async function main() {
  console.clear();

  banner();
  await pausa(400);

  cabecera();
  await pausa(300);

  // Pasos visuales de carga
  const pasos = [
    "Cargando configuración...",
    "Iniciando módulos...",
    "Conectando a WhatsApp...",
    "Cargando comandos...",
    "Preparando eventos...",
  ];

  for (let i = 0; i < pasos.length; i++) {
    progreso(i + 1, pasos.length, pasos[i]);
    await pausa(350);
  }

  console.log();
  separador(dorado);
  console.log(dorado(`   ✅ ${CONFIG.botName} listo para operar`));
  separador(dorado);
  console.log();

  // ── Arrancar lógica real del bot ──────────────────────────────────────────
  await startBot();
}

main().catch((err) => {
  console.error(chalk.red("💥 Error fatal en arranque:"), err.message);
  process.exit(1);
});