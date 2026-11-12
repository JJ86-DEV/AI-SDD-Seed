/**
 * tooling.mjs
 * ------------------------------------------------------------
 * "AI-SDD Tooling" — CLI de preparación del entorno para
 * trabajar con el sistema de agentes de este repositorio.
 *
 * Soporta dos modos:
 *
 *   1) Interactivo (sin argumentos): muestra un menú con inquirer.
 *        pnpm run tooling
 *
 *   2) Directo (con argumentos, apto para CI/scripts):
 *        pnpm run tooling -- doctor [--deep] [--json]
 *        pnpm run tooling -- setup rtk|codegraph|codebase-memory|skills|all
 *        pnpm run tooling -- run vectorize|install|all
 *
 * En modo directo, las preguntas de confirmación se resuelven
 * automáticamente con `--yes` (asume "sí" a todo) o `--no`
 * (asume "no" a todo); por defecto, sin ninguno de los dos,
 * se piden por inquirer igualmente (modo semi-interactivo).
 * ------------------------------------------------------------
 */

import inquirer from "inquirer";
import figlet from "figlet";
import { runAllChecks, statusRank, printChecks, hyperlink } from "../doctor/checks.mjs";
import { setupRtk, setupCodegraph, setupCodebaseMemory, setupSkills, setupMcpServers, setupAll } from "../setup/actions.mjs";
import {
  runVectorize,
  runInstallDeps,
  runAll,
  runVectorizeTest,
  runMemoryLookup,
  runMemoryFileRead,
  runMemorySemanticCache,
} from "../run/actions.mjs";

const TITLE = "AI-SDD Tooling";
const FIGLET_FONT = "Small";

/**
 * Banner ASCII generado con figlet (letras grandes formadas por
 * guiones/pipes). Si por lo que sea figlet no puede renderizar la fuente
 * (entorno raro, fuente no encontrada, etc.) se cae a un título simple en
 * texto plano para no romper la CLI.
 */
function banner() {
  let asciiTitle;
  try {
    asciiTitle = figlet.textSync(TITLE, { font: FIGLET_FONT }).split("\n").filter((l) => l.length > 0);
  } catch {
    asciiTitle = [TITLE];
  }
  const width = Math.max(...asciiTitle.map((l) => l.length));
  const line = "─".repeat(width + 2);
  console.log(`\n╭${line}╮`);
  for (const row of asciiTitle) {
    console.log(`│ ${row.padEnd(width)} │`);
  }
  console.log(`╰${line}╯\n`);
}

// ---------------------------------------------------------------
// io helpers (desacoplan las acciones de inquirer)
// ---------------------------------------------------------------
function makeIo({ yes = null } = {}) {
  return {
    log: (msg) => console.log(msg),
    confirm: async (message, defaultValue = true) => {
      if (yes === true) return true;
      if (yes === false) return false;
      const { value } = await inquirer.prompt([
        { type: "confirm", name: "value", message, default: defaultValue },
      ]);
      return value;
    },
    // choices: [{ name, value }, ...]. En modo no interactivo (--yes/--no)
    // no hay forma de "elegir" nada con sentido, así que se asume siempre
    // la última opción (por convención, en todos los submenús de esta CLI
    // la última entrada es la salida: "← Volver" / "← Cancelar" / "← Salir").
    // Esto evita bucles infinitos en submenús ejecutados en CI/scripts.
    select: async (message, choices) => {
      if (yes !== null) {
        return choices[choices.length - 1]?.value;
      }
      const { value } = await inquirer.prompt([
        { type: "select", name: "value", message, choices },
      ]);
      return value;
    },
    // Prompt de texto libre. En modo no interactivo (--yes/--no) devuelve
    // el defaultValue indicado (o cadena vacía si no se especifica).
    input: async (message, defaultValue = "") => {
      if (yes !== null) {
        return defaultValue;
      }
      const { value } = await inquirer.prompt([
        { type: "input", name: "value", message, default: defaultValue },
      ]);
      return value;
    },
  };
}

// ---------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------
async function runDoctor({ deep = false } = {}) {
  console.log("🩺 Doctor del entorno\n");
  const checks = runAllChecks({ deep });
  printChecks(checks);
  const worst = checks.reduce((acc, c) => Math.min(acc, statusRank(c.status)), 2);
  const counts = checks.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nResumen: ${counts.ok ?? 0} ok, ${counts.warn ?? 0} warn, ${counts.fail ?? 0} fail.\n`);
  return worst;
}

// ---------------------------------------------------------------
// Menús interactivos
// ---------------------------------------------------------------
async function menuSetup(io) {
  let back = false;
  while (!back) {
    const { choice } = await inquirer.prompt([
      {
        type: "select",
        name: "choice",
        message: "Setup — ¿qué quieres configurar?",
        choices: [
          { name: "RTK", value: "rtk" },
          { name: "CodeGraph (CLI fallback)", value: "codegraph" },
          { name: "CodeBase memory (servidor MCP)", value: "codebase-memory" },
          { name: "Skills básicas", value: "skills" },
          { name: "Servidores MCP (.mcp.json: codegraph / ado / codebase-memory)", value: "mcp" },
          { name: "Todo (RTK + CodeGraph + CodeBase memory + Skills + MCP)", value: "all" },
          new inquirer.Separator(),
          { name: "← Volver", value: "back" },
        ],
      },
    ]);

    if (choice === "back") back = true;
    else if (choice === "rtk") printSetupResult(io, await setupRtk(io));
    else if (choice === "codegraph") printSetupResult(io, await setupCodegraph(io));
    else if (choice === "codebase-memory") printSetupResult(io, await setupCodebaseMemory(io));
    else if (choice === "skills") printSetupResult(io, await setupSkills(io));
    else if (choice === "mcp") printSetupResult(io, await setupMcpServers(io));
    else if (choice === "all") printSetupResult(io, await setupAll(io));
  }
}

function printSetupResult(io, result) {
  if (!result) return;
  const icon = result.status === "ok" ? "✅" : result.status === "warn" ? "⚠️ " : "❌";
  io.log(`\n${icon} [${result.name}] ${result.message}`);
  if (result.hint) {
    const isUrl = /^https?:\/\//i.test(result.hint);
    io.log(`   ${isUrl ? hyperlink(result.hint) : result.hint}`);
  }
}

async function menuRun(io) {
  let back = false;
  while (!back) {
    const { choice } = await inquirer.prompt([
      {
        type: "select",
        name: "choice",
        message: "Run — ¿qué quieres ejecutar?",
        choices: [
          { name: "Indexación del corpus (vectorize:project)", value: "vectorize" },
          { name: "Instalación de dependencias node (pnpm install)", value: "install" },
          { name: "Ambas (install + vectorize)", value: "all" },
          new inquirer.Separator(),
          { name: "Query de prueba contra el corpus (vectorize:test)", value: "vectorize-test" },
          { name: "Búsqueda semántica en el corpus (memory:lookup)", value: "memory-lookup" },
          { name: "Lectura de fichero con cache (memory:file-read)", value: "memory-file-read" },
          { name: "Cache semántica de prompts (memory:semantic-cache)", value: "memory-semantic-cache" },
          new inquirer.Separator(),
          { name: "← Volver", value: "back" },
        ],
      },
    ]);

    if (choice === "back") back = true;
    else if (choice === "vectorize") printSetupResult(io, await runVectorize(io));
    else if (choice === "install") printSetupResult(io, await runInstallDeps(io));
    else if (choice === "all") await runAll(io);
    else if (choice === "vectorize-test") printSetupResult(io, await runVectorizeTest(io));
    else if (choice === "memory-lookup") printSetupResult(io, await runMemoryLookup(io));
    else if (choice === "memory-file-read") printSetupResult(io, await runMemoryFileRead(io));
    else if (choice === "memory-semantic-cache") printSetupResult(io, await runMemorySemanticCache(io));
  }
}

async function interactiveMenu() {
  banner();
  const io = makeIo();
  let exit = false;
  while (!exit) {
    const { choice } = await inquirer.prompt([
      {
        type: "select",
        name: "choice",
        message: "¿Qué quieres hacer?",
        choices: [
          { name: "🩺 Doctor — comprobar estado del entorno", value: "doctor" },
          { name: "🔧 Setup — configurar RTK / CodeGraph / CodeBase memory / Skills", value: "setup" },
          { name: "▶️  Run — indexar corpus / instalar dependencias", value: "run" },
          new inquirer.Separator(),
          { name: "Salir", value: "exit" },
        ],
      },
    ]);

    if (choice === "doctor") await runDoctor();
    else if (choice === "setup") await menuSetup(io);
    else if (choice === "run") await menuRun(io);
    else exit = true;
  }
  console.log("\n👋 Hasta luego.\n");
}

// ---------------------------------------------------------------
// Modo argumentos (no interactivo / CI)
// ---------------------------------------------------------------
function parseFlags(argv) {
  return {
    deep: argv.includes("--deep"),
    json: argv.includes("--json"),
    yes: argv.includes("--yes") ? true : argv.includes("--no") ? false : null,
  };
}

async function directMode(argv) {
  const [command, subcommand] = argv.filter((a) => !a.startsWith("--"));
  const flags = parseFlags(argv);
  const io = makeIo({ yes: flags.yes });

  banner();

  if (command === "doctor") {
    const worst = await runDoctor({ deep: flags.deep });
    process.exit(worst === 0 ? 1 : 0);
  }

  if (command === "setup") {
    const map = {
      rtk: setupRtk,
      codegraph: setupCodegraph,
      "codebase-memory": setupCodebaseMemory,
      skills: setupSkills,
      mcp: setupMcpServers,
      all: setupAll,
    };
    const fn = map[subcommand];
    if (!fn) {
      console.error(`Subcomando de setup desconocido: '${subcommand}'. Usa: rtk | codegraph | codebase-memory | skills | mcp | all`);
      process.exit(2);
    }
    await fn(io);
    process.exit(0);
  }

  if (command === "run") {
    const map = {
      vectorize: runVectorize,
      install: runInstallDeps,
      all: runAll,
      "vectorize-test": runVectorizeTest,
      "memory-lookup": runMemoryLookup,
      "memory-file-read": runMemoryFileRead,
      "memory-semantic-cache": runMemorySemanticCache,
    };
    const fn = map[subcommand];
    if (!fn) {
      console.error(
        `Subcomando de run desconocido: '${subcommand}'. Usa: vectorize | install | all | vectorize-test | memory-lookup | memory-file-read | memory-semantic-cache`
      );
      process.exit(2);
    }
    await fn(io);
    process.exit(0);
  }

  console.error(
    `Comando desconocido: '${command ?? ""}'.\n` +
      "Uso:\n" +
      "  pnpm run tooling                          # menú interactivo\n" +
      "  pnpm run tooling -- doctor [--deep] [--json]\n" +
      "  pnpm run tooling -- setup <rtk|codegraph|codebase-memory|skills|mcp|all> [--yes|--no]\n" +
      "  pnpm run tooling -- run <vectorize|install|all|vectorize-test|memory-lookup|memory-file-read|memory-semantic-cache> [--yes|--no]"
  );
  process.exit(2);
}

// ---------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  if (argv.length === 0) {
    await interactiveMenu();
  } else {
    await directMode(argv);
  }
}

main();
