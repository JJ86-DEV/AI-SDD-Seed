/**
 * actions.mjs (setup)
 * ------------------------------------------------------------
 * Acciones de "Setup" invocables desde la CLI interactiva
 * (scripts/cli/tooling.mjs) o desde modo argumentos.
 *
 * Cada acción recibe un objeto `io` con helpers de interacción
 * (para no acoplar este módulo a inquirer directamente):
 *   io.confirm(message, defaultValue) -> Promise<boolean>
 *   io.select(message, choices)       -> Promise<value>
 *   io.log(message)
 *
 * Esto permite testear/usar las acciones también en modo no
 * interactivo (io.confirm siempre resuelve `false` o `true`
 * según el flag --yes; io.select devuelve el valor por defecto
 * indicado por el propio wrapper no interactivo).
 * ------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  SKILLS_DIR,
  RTK_REPO_URL,
  RTK_WINGET_ID,
  CODEGRAPH_REPO_URL,
  CODEGRAPH_INSTALL_PS1_URL,
  CODEBASE_MEMORY_REPO_URL,
  CODEBASE_MEMORY_INSTALL_PS1_URL,
  CODEBASE_MEMORY_UI_PORT,
  SKILLS_LOCK_FILE,
  readJson,
  tryExec,
  tryExecArgs,
  spawnDetached,
  checkRtk,
  checkCodeGraphProvider,
  checkSkills,
  isCodegraphInstalled,
  isCodebaseMemoryInstalled,
  getCodebaseMemoryAutoIndexStatus,
  hyperlink,
  MCP_CONFIG_REPO_FILE,
  MCP_CONFIG_USER_FILE,
  MCP_SERVER_DEFS,
  ADO_DEFAULT_ORG,
  readMcpConfig,
  mergeMcpServers,
} from "../doctor/checks.mjs";

// ---------------------------------------------------------------
// Setup: RTK
// ---------------------------------------------------------------
export async function setupRtk(io) {
  io.log("\n== Setup: RTK ==\n");
  const check = checkRtk();
  if (check.status === "ok") {
    io.log(`✅ ${check.message}`);
    return { name: "setup-rtk", status: "ok", message: check.message };
  }

  io.log(`❌ ${check.message}`);
  io.log(`   Repositorio y guía de instalación: ${RTK_REPO_URL}`);

  const winget = tryExec("winget --version");
  if (!winget.ok) {
    io.log("⚠️  'winget' no está disponible en este equipo.");
    io.log(`   Instala rtk manualmente siguiendo los pasos de ${RTK_REPO_URL}`);
    return {
      name: "setup-rtk",
      status: "warn",
      message: "winget no disponible; instalación manual requerida.",
      hint: RTK_REPO_URL,
    };
  }

  const proceed = await io.confirm(
    `¿Instalar rtk automáticamente con 'winget install ${RTK_WINGET_ID}'?`,
    true
  );
  if (!proceed) {
    io.log("Instalación cancelada. Puedes ejecutarla manualmente más tarde:");
    io.log(`   winget install ${RTK_WINGET_ID}`);
    return { name: "setup-rtk", status: "warn", message: "Instalación pospuesta por el usuario." };
  }

  io.log(`\n🔧 Ejecutando: winget install ${RTK_WINGET_ID} ...\n`);
  const install = tryExec(
    `winget install --id ${RTK_WINGET_ID} -e --accept-package-agreements --accept-source-agreements`,
    5 * 60 * 1000
  );
  if (install.ok) {
    io.log("✅ rtk instalado correctamente. Reinicia la terminal para refrescar el PATH si el siguiente check falla.");
    return { name: "setup-rtk", status: "ok", message: "Instalado vía winget." };
  }
  io.log("❌ La instalación automática falló. Instálalo manualmente:");
  io.log(`   ${RTK_REPO_URL}`);
  io.log(install.output);
  return { name: "setup-rtk", status: "fail", message: "Falló winget install.", hint: install.output };
}

// ---------------------------------------------------------------
// Setup: CodeGraph (CLI fallback)
// ------------------------------------------------------------
// Submenú navegable: Instalar (ps1/pnpm) | Guía+docu | Indexar (init) |
// Conectar agentes (codegraph install) | Desinstalar | Volver
// ------------------------------------------------------------
function codegraphInstallGuide(io) {
  io.log("\n📋 Guía de instalación manual de CodeGraph:\n");
  io.log("  Opción A (script oficial, PowerShell):");
  io.log(`   irm ${CODEGRAPH_INSTALL_PS1_URL} | iex`);
  io.log("  Opción B (npm/pnpm global):");
  io.log("   pnpm add -g @colbymchenry/codegraph   (o: npm i -g @colbymchenry/codegraph)");
  io.log("  Después de instalar el CLI, conecta los agentes soportados:");
  io.log("   codegraph install");
  io.log("  Y finalmente indexa el proyecto:");
  io.log("   codegraph init");
  io.log(`\n  Documentación completa: ${CODEGRAPH_REPO_URL}\n`);
}

async function codegraphInstallCli(io) {
  if (isCodegraphInstalled()) {
    io.log("✅ El CLI 'codegraph' ya está instalado y disponible en PATH.");
    return { name: "setup-codegraph-install", status: "ok", message: "Ya instalado." };
  }

  const method = await io.select("¿Cómo quieres instalar el CLI de CodeGraph?", [
    { name: "Script oficial (install.ps1 vía PowerShell)", value: "ps1" },
    { name: "Paquete global con pnpm (pnpm add -g)", value: "pnpm" },
    { name: "Ver guía manual + enlace a la documentación", value: "guide" },
    { name: "← Cancelar", value: "cancel" },
  ]);

  if (method === "cancel") {
    return { name: "setup-codegraph-install", status: "warn", message: "Instalación cancelada por el usuario." };
  }
  if (method === "guide") {
    codegraphInstallGuide(io);
    return { name: "setup-codegraph-install", status: "warn", message: "Se mostró la guía manual." };
  }

  const proceed = await io.confirm(
    method === "ps1"
      ? `¿Ejecutar el script oficial de instalación (${CODEGRAPH_INSTALL_PS1_URL})?`
      : "¿Ejecutar 'pnpm add -g @colbymchenry/codegraph'?",
    true
  );
  if (!proceed) {
    return { name: "setup-codegraph-install", status: "warn", message: "Instalación pospuesta por el usuario." };
  }

  const cmd =
    method === "ps1"
      ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm ${CODEGRAPH_INSTALL_PS1_URL} | iex"`
      : "pnpm add -g @colbymchenry/codegraph";

  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const install = tryExec(cmd, 5 * 60 * 1000);
  if (install.ok && isCodegraphInstalled()) {
    io.log("✅ CodeGraph CLI instalado correctamente.");
    return { name: "setup-codegraph-install", status: "ok", message: "Instalado." };
  }
  io.log("❌ La instalación automática falló o no se detectó el binario en PATH (reinicia la terminal e inténtalo de nuevo).");
  io.log(install.output);
  codegraphInstallGuide(io);
  return { name: "setup-codegraph-install", status: "fail", message: "Falló la instalación del CLI.", hint: install.output };
}

async function codegraphConnectAgents(io) {
  const proceed = await io.confirm("¿Ejecutar 'codegraph install' para conectar los agentes soportados (Copilot, etc.)?", true);
  if (!proceed) {
    return { name: "setup-codegraph-connect", status: "warn", message: "Conexión de agentes pospuesta por el usuario." };
  }
  io.log("\n🔧 Ejecutando: codegraph install ...\n");
  const res = tryExec("codegraph install", 2 * 60 * 1000);
  if (res.ok) {
    io.log("✅ Agentes conectados correctamente.");
    return { name: "setup-codegraph-connect", status: "ok", message: "Agentes conectados." };
  }
  io.log("❌ Falló 'codegraph install'.");
  io.log(res.output);
  return { name: "setup-codegraph-connect", status: "fail", message: "Falló 'codegraph install'.", hint: res.output };
}

async function codegraphIndexProject(io) {
  io.log("🔍 Comprobando estado del índice ('codegraph status')...");
  const status = tryExec("codegraph status", 30000);
  let proceed = true;
  if (status.ok) {
    io.log("✅ El índice de CodeGraph ya está disponible.");
    proceed = await io.confirm("¿Reindexar de todas formas ('codegraph init')?", false);
  } else {
    proceed = await io.confirm("El índice no está inicializado. ¿Ejecutar 'codegraph init' ahora?", true);
  }

  if (!proceed) {
    return {
      name: "setup-codegraph-index",
      status: status.ok ? "ok" : "warn",
      message: status.ok ? "Índice ya inicializado." : "Indexación pospuesta por el usuario.",
    };
  }

  io.log("\n🔧 Ejecutando: codegraph init ...\n");
  const init = tryExec("codegraph init", 5 * 60 * 1000);
  if (init.ok) {
    io.log("✅ CodeGraph indexado correctamente.");
    return { name: "setup-codegraph-index", status: "ok", message: "Indexado." };
  }
  io.log("❌ Falló la indexación de CodeGraph.");
  io.log(init.output);
  return { name: "setup-codegraph-index", status: "fail", message: "Falló 'codegraph init'.", hint: init.output };
}

async function codegraphUninstall(io) {
  const proceed = await io.confirm(
    "¿Desinstalar CodeGraph? Esto ejecutará 'codegraph uninstall' (revierte la configuración en los agentes).",
    false
  );
  if (!proceed) {
    return { name: "setup-codegraph-uninstall", status: "warn", message: "Desinstalación cancelada por el usuario." };
  }
  const keepCli = await io.confirm("¿Conservar el CLI instalado (solo desconectar agentes, --keep-cli)?", true);
  const cmd = keepCli ? "codegraph uninstall --keep-cli --yes" : "codegraph uninstall --yes";
  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 2 * 60 * 1000);
  if (res.ok) {
    io.log("✅ CodeGraph desinstalado/desconectado correctamente.");
    return { name: "setup-codegraph-uninstall", status: "ok", message: "Desinstalado." };
  }
  io.log("❌ Falló 'codegraph uninstall'.");
  io.log(res.output);
  return { name: "setup-codegraph-uninstall", status: "fail", message: "Falló la desinstalación.", hint: res.output };
}

export async function setupCodegraph(io) {
  io.log("\n== Setup: CodeGraph (CLI fallback) ==\n");
  const providerCheck = checkCodeGraphProvider();
  io.log(`ℹ️  Proveedor configurado en .agents/config.json: ${providerCheck.message}`);
  io.log(`ℹ️  Instalado en este equipo: ${isCodegraphInstalled() ? "sí" : "no"}`);

  const results = [];
  let exit = false;
  while (!exit) {
    const choice = await io.select("CodeGraph — ¿qué quieres hacer?", [
      { name: "Instalar CLI (ps1 o pnpm)", value: "install" },
      { name: "Ver guía de instalación + enlace a la documentación", value: "guide" },
      { name: "Conectar agentes (codegraph install)", value: "connect" },
      { name: "Indexar proyecto (codegraph init)", value: "index" },
      { name: "Desinstalar CodeGraph", value: "uninstall" },
      { name: "← Volver", value: "back" },
    ]);

    if (choice === "back") {
      exit = true;
    } else if (choice === "install") {
      results.push(await codegraphInstallCli(io));
    } else if (choice === "guide") {
      codegraphInstallGuide(io);
    } else if (choice === "connect") {
      results.push(await codegraphConnectAgents(io));
    } else if (choice === "index") {
      results.push(await codegraphIndexProject(io));
    } else if (choice === "uninstall") {
      results.push(await codegraphUninstall(io));
    }
  }

  if (results.length === 0) {
    return { name: "setup-codegraph", status: "warn", message: "Sin cambios (el usuario salió del submenú)." };
  }
  const worstStatus = results.some((r) => r.status === "fail")
    ? "fail"
    : results.some((r) => r.status === "warn")
    ? "warn"
    : "ok";
  return {
    name: "setup-codegraph",
    status: worstStatus,
    message: `Acciones ejecutadas: ${results.map((r) => r.name).join(", ")}`,
  };
}

// ---------------------------------------------------------------
// Setup: CodeBase memory (servidor MCP)
// ------------------------------------------------------------
// Submenú navegable: Instalar (guiado) | Guía+docu | Levantar UI (9749) |
// Habilitar/Deshabilitar auto_index | Indexar proyecto | Volver
// ------------------------------------------------------------
function detectIdes() {
  return {
    visualStudio: existsSync(join(ROOT, ".vs")),
    vscode: existsSync(join(ROOT, ".vscode")),
  };
}

function codebaseMemoryInstallGuide(io) {
  io.log("\n📋 Guía de instalación manual de codebase-memory-mcp (Windows):\n");
  io.log(`   Invoke-WebRequest -Uri ${CODEBASE_MEMORY_INSTALL_PS1_URL} -OutFile install.ps1`);
  io.log("   Unblock-File .\\install.ps1");
  io.log("   .\\install.ps1");
  io.log("   # Si PowerShell bloquea la ejecución del script:");
  io.log("   Set-ExecutionPolicy -Scope Process Bypass");
  io.log("\n  El instalador auto-configura los agentes soportados (incluye GitHub Copilot / Visual Studio).");
  io.log("  Alternativa manual: descarga el ZIP/TAR desde el repo y sigue las instrucciones del README.");
  io.log("  Tras instalar, reinicia el coding agent (Visual Studio / VS Code).");
  io.log(`\n  Documentación completa: ${CODEBASE_MEMORY_REPO_URL}\n`);
}

async function codebaseMemoryInstall(io) {
  if (isCodebaseMemoryInstalled()) {
    io.log("✅ 'codebase-memory-mcp' ya está instalado y disponible en PATH.");
    return { name: "setup-codebase-memory-install", status: "ok", message: "Ya instalado." };
  }

  const method = await io.select("¿Cómo quieres instalar codebase-memory-mcp?", [
    { name: "Guiado (descargar y ejecutar install.ps1 automáticamente)", value: "guided" },
    { name: "Ver guía manual + enlace a la documentación", value: "guide" },
    { name: "← Cancelar", value: "cancel" },
  ]);

  if (method === "cancel") {
    return { name: "setup-codebase-memory-install", status: "warn", message: "Instalación cancelada por el usuario." };
  }
  if (method === "guide") {
    codebaseMemoryInstallGuide(io);
    return { name: "setup-codebase-memory-install", status: "warn", message: "Se mostró la guía manual." };
  }

  const proceed = await io.confirm(
    `¿Descargar y ejecutar el instalador oficial (${CODEBASE_MEMORY_INSTALL_PS1_URL})?`,
    true
  );
  if (!proceed) {
    return { name: "setup-codebase-memory-install", status: "warn", message: "Instalación pospuesta por el usuario." };
  }

  const cmd =
    `powershell -NoProfile -ExecutionPolicy Bypass -Command ` +
    `"Invoke-WebRequest -Uri ${CODEBASE_MEMORY_INSTALL_PS1_URL} -OutFile install.ps1; ` +
    `Unblock-File .\\install.ps1; .\\install.ps1"`;

  io.log(`\n🔧 Ejecutando instalador oficial de codebase-memory-mcp ...\n`);
  const install = tryExec(cmd, 5 * 60 * 1000);
  if (install.ok && isCodebaseMemoryInstalled()) {
    io.log("✅ codebase-memory-mcp instalado correctamente.");
    io.log("⚠️  Reinicia el coding agent (Visual Studio / VS Code) para que detecte el nuevo servidor MCP.");
    return { name: "setup-codebase-memory-install", status: "ok", message: "Instalado." };
  }
  io.log("❌ La instalación automática falló o no se detectó el binario (revisa la política de ejecución de PowerShell).");
  io.log(install.output);
  codebaseMemoryInstallGuide(io);
  return { name: "setup-codebase-memory-install", status: "fail", message: "Falló la instalación.", hint: install.output };
}

async function codebaseMemoryStartUi(io) {
  const proceed = await io.confirm(`¿Levantar la UI de codebase-memory-mcp en el puerto ${CODEBASE_MEMORY_UI_PORT}?`, true);
  if (!proceed) {
    return { name: "setup-codebase-memory-ui", status: "warn", message: "Arranque de UI pospuesto por el usuario." };
  }

  // Persistir la config de UI (habilitada + puerto). Estas flags quedan
  // guardadas y las recogerá el servidor MCP la próxima vez que arranque
  // (p.ej. al reiniciar el coding agent), o el proceso que lancemos ahora.
  io.log(`\n🔧 Configurando: codebase-memory-mcp --ui=true --port=${CODEBASE_MEMORY_UI_PORT} ...\n`);
  const configRes = tryExecArgs("codebase-memory-mcp", [`--ui=true`, `--port=${CODEBASE_MEMORY_UI_PORT}`], 15000);
  if (!configRes.ok) {
    io.log("❌ No se pudo guardar la configuración de la UI.");
    io.log(configRes.output);
    return { name: "setup-codebase-memory-ui", status: "fail", message: "Falló la configuración de la UI.", hint: configRes.output };
  }

  // Comprobar si ya hay algo escuchando en el puerto antes de lanzar un
  // segundo proceso.
  const alreadyUp = tryExec(
    `powershell -NoProfile -Command "(Test-NetConnection -ComputerName localhost -Port ${CODEBASE_MEMORY_UI_PORT} -WarningAction SilentlyContinue).TcpTestSucceeded"`,
    10000
  );
  if (alreadyUp.ok && alreadyUp.output.trim().toLowerCase() === "true") {
    const url = `http://localhost:${CODEBASE_MEMORY_UI_PORT}`;
    io.log(`✅ Ya hay un servicio escuchando en el puerto ${CODEBASE_MEMORY_UI_PORT} (probablemente la UI).`);
    io.log(`   Ábrela en: ${hyperlink(url)}`);
    return { name: "setup-codebase-memory-ui", status: "ok", message: `UI ya disponible en ${url}`, hint: url };
  }

  // El binario, ejecutado sin subcomando, arranca el servidor MCP (stdio) y
  // con --ui=true levanta también el HTTP de visualización. Lo lanzamos
  // desacoplado (detached) para que sobreviva a la CLI, con logs a fichero.
  const logFile = join(ROOT, "vectorized", "codebase-memory-mcp-ui.log");
  io.log(`\n🔧 Arrancando proceso en background (logs: ${logFile}) ...\n`);
  const spawnRes = spawnDetached("codebase-memory-mcp", [`--ui=true`, `--port=${CODEBASE_MEMORY_UI_PORT}`], logFile);
  if (!spawnRes.ok) {
    io.log("❌ No se pudo lanzar el proceso de la UI.");
    io.log(spawnRes.error);
    return { name: "setup-codebase-memory-ui", status: "fail", message: "Falló el arranque de la UI.", hint: spawnRes.error };
  }

  io.log(`✅ Proceso lanzado (PID ${spawnRes.pid}). Verificando que el puerto responda...`);
  const verify = tryExec(
    `powershell -NoProfile -Command "for ($i=0; $i -lt 8; $i++) { if ((Test-NetConnection -ComputerName localhost -Port ${CODEBASE_MEMORY_UI_PORT} -WarningAction SilentlyContinue).TcpTestSucceeded) { Write-Output 'True'; break }; Start-Sleep -Seconds 1 }"`,
    15000
  );
  if (verify.ok && verify.output.trim().toLowerCase().includes("true")) {
    const url = `http://localhost:${CODEBASE_MEMORY_UI_PORT}`;
    io.log(`✅ UI disponible en ${hyperlink(url)}`);
    return { name: "setup-codebase-memory-ui", status: "ok", message: `UI arrancada en ${url}`, hint: url };
  }
  io.log(`⚠️  El proceso se lanzó (PID ${spawnRes.pid}) pero el puerto no respondió a tiempo. Revisa el log: ${logFile}`);
  return { name: "setup-codebase-memory-ui", status: "warn", message: "UI lanzada pero no verificada; revisa el log.", hint: logFile };
}

async function codebaseMemoryToggleAutoIndex(io) {
  const current = getCodebaseMemoryAutoIndexStatus();
  if (current.known) {
    io.log(`ℹ️  Estado actual de auto_index: ${current.enabled ? "ON" : "OFF"}`);
  } else {
    io.log("⚠️  No se pudo determinar el estado actual de auto_index (¿está codebase-memory-mcp instalado y en PATH?).");
    io.log(current.raw);
  }

  const targetOn = await io.confirm(
    "¿Quieres HABILITAR auto_index? (responde 'no' para deshabilitarlo)",
    current.known ? !current.enabled : true
  );
  const args = ["config", "set", "auto_index", targetOn ? "true" : "false"];
  io.log(`\n🔧 Ejecutando: codebase-memory-mcp ${args.join(" ")} ...\n`);
  const res = tryExecArgs("codebase-memory-mcp", args, 10000);
  if (res.ok) {
    io.log(`✅ auto_index ${targetOn ? "habilitado" : "deshabilitado"} correctamente.`);
    return { name: "setup-codebase-memory-autoindex", status: "ok", message: `auto_index=${targetOn}.` };
  }
  io.log("❌ No se pudo cambiar auto_index.");
  io.log(res.output);
  return { name: "setup-codebase-memory-autoindex", status: "fail", message: "Falló el cambio de auto_index.", hint: res.output };
}

async function codebaseMemoryIndexProject(io) {
  const proceed = await io.confirm(`¿Indexar el proyecto actual (${ROOT}) con codebase-memory-mcp?`, true);
  if (!proceed) {
    return { name: "setup-codebase-memory-index", status: "warn", message: "Indexación pospuesta por el usuario." };
  }
  // repo_path debe ir en formato POSIX (forward slashes) dentro del JSON,
  // y pasado como argumento independiente via execFileSync (sin pasar por
  // el shell) para evitar problemas de escaping con backslashes/comillas.
  const repoPath = ROOT.replace(/\\/g, "/");
  const argsJson = JSON.stringify({ repo_path: repoPath });
  io.log(`\n🔧 Ejecutando: codebase-memory-mcp cli index_repository '${argsJson}' ...\n`);
  io.log("   (esto puede tardar varios minutos en proyectos grandes; se muestra progreso en vivo)\n");
  const res = tryExecArgs("codebase-memory-mcp", ["cli", "index_repository", argsJson], 15 * 60 * 1000);
  if (res.ok) {
    io.log("✅ Proyecto indexado correctamente.");
    return { name: "setup-codebase-memory-index", status: "ok", message: "Proyecto indexado." };
  }
  io.log("❌ Falló la indexación del proyecto.");
  io.log(res.output);
  return { name: "setup-codebase-memory-index", status: "fail", message: "Falló la indexación.", hint: res.output };
}

export async function setupCodebaseMemory(io) {
  io.log("\n== Setup: CodeBase memory (servidor MCP) ==\n");

  const providerCheck = checkCodeGraphProvider();
  io.log(`ℹ️  Proveedor configurado en .agents/config.json: ${providerCheck.message}`);
  io.log(`ℹ️  Instalado en este equipo: ${isCodebaseMemoryInstalled() ? "sí" : "no"}`);

  const ides = detectIdes();
  if (!ides.visualStudio && !ides.vscode) {
    io.log("⚠️  No se detectó carpeta .vs/ ni .vscode/ en la raíz del repo. Abre el proyecto una vez con el IDE antes de continuar.");
  } else {
    io.log(
      `🔎 IDE(s) detectado(s): ${[ides.visualStudio && "Visual Studio (.vs)", ides.vscode && "VS Code (.vscode)"]
        .filter(Boolean)
        .join(", ")}`
    );
  }

  const results = [];
  let exit = false;
  while (!exit) {
    const choice = await io.select("CodeBase memory — ¿qué quieres hacer?", [
      { name: "Instalar (guiado)", value: "install" },
      { name: "Ver guía de instalación + enlace a la documentación", value: "guide" },
      { name: `Levantar UI (puerto ${CODEBASE_MEMORY_UI_PORT})`, value: "ui" },
      { name: "Habilitar/Deshabilitar auto_index (revisa estado actual)", value: "autoindex" },
      { name: "Indexar proyecto", value: "index" },
      { name: "← Volver", value: "back" },
    ]);

    if (choice === "back") {
      exit = true;
    } else if (choice === "install") {
      results.push(await codebaseMemoryInstall(io));
    } else if (choice === "guide") {
      codebaseMemoryInstallGuide(io);
    } else if (choice === "ui") {
      results.push(await codebaseMemoryStartUi(io));
    } else if (choice === "autoindex") {
      results.push(await codebaseMemoryToggleAutoIndex(io));
    } else if (choice === "index") {
      results.push(await codebaseMemoryIndexProject(io));
    }
  }

  if (results.length === 0) {
    return { name: "setup-codebase-memory", status: "warn", message: "Sin cambios (el usuario salió del submenú)." };
  }
  const worstStatus = results.some((r) => r.status === "fail")
    ? "fail"
    : results.some((r) => r.status === "warn")
    ? "warn"
    : "ok";
  return {
    name: "setup-codebase-memory",
    status: worstStatus,
    message: results.map((r) => r.message).join(" | "),
  };
}

// ---------------------------------------------------------------
// Setup: Skills
// ------------------------------------------------------------
// Skills propietarias (repo, .agents/skills) + skills gestionadas
// vía skills-lock.json (estándar skills.sh: { version, skills: { name:
// { source: "owner/repo", sourceType: "github", skillPath, computedHash } } }),
// instaladas con:
//   npx skills add https://github.com/<owner>/<repo> --skill <skill-name> -a github-copilot
// para que se guarden en .agents/skills.
// ------------------------------------------------------------
function readSkillsLock() {
  if (!existsSync(SKILLS_LOCK_FILE)) return null;
  try {
    return readJson(SKILLS_LOCK_FILE);
  } catch {
    return null;
  }
}

function isSkillInstalled(skillName) {
  return existsSync(join(SKILLS_DIR, skillName, "SKILL.md"));
}

/** Normaliza skills-lock.json (formato skills.sh: { version, skills: { name: { source, sourceType } } }) a una lista [{ skill, repo }]. */
function listLockedSkills(lock) {
  if (!lock || !lock.skills || typeof lock.skills !== "object") return [];
  return Object.entries(lock.skills).map(([skill, meta]) => {
    const source = meta.source ?? meta.repo ?? "";
    const repo =
      meta.sourceType === "github" && source && !source.startsWith("http")
        ? `https://github.com/${source}`
        : source;
    return { skill, repo };
  });
}

async function installLockedSkill(io, entry) {
  const cmd = `npx skills add ${entry.repo} --skill ${entry.skill} -a github-copilot`;
  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 3 * 60 * 1000);
  if (res.ok && isSkillInstalled(entry.skill)) {
    io.log(`✅ Skill '${entry.skill}' instalada correctamente.`);
    return { name: `setup-skill-${entry.skill}`, status: "ok", message: "Instalada." };
  }
  io.log(`❌ Falló la instalación de la skill '${entry.skill}'.`);
  io.log(res.output);
  return { name: `setup-skill-${entry.skill}`, status: "fail", message: "Falló la instalación.", hint: res.output };
}

async function setupLockedSkills(io) {
  const lock = readSkillsLock();
  const lockedSkills = listLockedSkills(lock);
  if (lockedSkills.length === 0) {
    io.log(`ℹ️  No se encontró 'skills-lock.json' en la raíz o no define skills (${SKILLS_LOCK_FILE}).`);
    return { name: "setup-skills-locked", status: "warn", message: "Sin skills-lock.json aplicable." };
  }

  const missing = lockedSkills.filter((entry) => !isSkillInstalled(entry.skill));
  if (missing.length === 0) {
    io.log("✅ Todas las skills declaradas en skills-lock.json ya están instaladas.");
    return { name: "setup-skills-locked", status: "ok", message: "Todas presentes." };
  }

  io.log(`⚠️  Faltan ${missing.length} skill(s) de skills-lock.json: ${missing.map((m) => m.skill).join(", ")}`);
  const choice = await io.select("¿Qué skills faltantes quieres instalar?", [
    { name: "Todas las faltantes", value: "all" },
    { name: "Elegir una por una", value: "one-by-one" },
    { name: "← Ninguna (volver)", value: "none" },
  ]);

  if (choice === "none") {
    return { name: "setup-skills-locked", status: "warn", message: "Instalación pospuesta por el usuario." };
  }

  const results = [];
  if (choice === "all") {
    for (const entry of missing) {
      results.push(await installLockedSkill(io, entry));
    }
  } else {
    let exit = false;
    while (!exit) {
      const remaining = missing.filter((m) => !isSkillInstalled(m.skill));
      if (remaining.length === 0) {
        io.log("✅ No quedan skills pendientes.");
        break;
      }
      const target = await io.select("Selecciona una skill a instalar", [
        ...remaining.map((m) => ({ name: m.skill, value: m.skill })),
        { name: "← Salir", value: "exit" },
      ]);
      if (target === "exit") {
        exit = true;
      } else {
        const entry = remaining.find((m) => m.skill === target);
        results.push(await installLockedSkill(io, entry));
      }
    }
  }

  if (results.length === 0) {
    return { name: "setup-skills-locked", status: "warn", message: "Sin instalaciones realizadas." };
  }
  const worstStatus = results.some((r) => r.status === "fail") ? "fail" : "ok";
  return {
    name: "setup-skills-locked",
    status: worstStatus,
    message: `Skills procesadas: ${results.map((r) => r.name).join(", ")}`,
  };
}

export async function setupSkills(io) {
  io.log("\n== Setup: Skills ==\n");
  const check = checkSkills();
  if (check.status === "ok") {
    io.log(`✅ Skills propietarias: ${check.message}`);
  } else {
    io.log(`❌ Skills propietarias: ${check.message}`);
    const proceed = await io.confirm(
      "¿Restaurar '.agents/skills' propietarias desde el repositorio ('git checkout -- .agents/skills')?",
      true
    );
    if (proceed) {
      io.log("\n🔧 Ejecutando: git checkout -- .agents/skills ...\n");
      const restore = tryExec("git checkout -- .agents/skills");
      const after = checkSkills();
      if (after.status === "ok") {
        io.log(`✅ ${after.message}`);
      } else {
        io.log("❌ La restauración no dejó las skills propietarias en estado correcto.");
        io.log(restore.output);
      }
    } else {
      io.log("Restauración pospuesta por el usuario.");
    }
  }

  const wantsLocked = await io.confirm("¿Revisar/instalar también skills gestionadas por skills-lock.json?", true);
  let lockedResult = { name: "setup-skills-locked", status: "warn", message: "Omitido por el usuario." };
  if (wantsLocked) {
    lockedResult = await setupLockedSkills(io);
  }

  const finalCheck = checkSkills();
  const worstStatus =
    finalCheck.status === "ok" && lockedResult.status !== "fail" ? "ok" : lockedResult.status === "fail" ? "fail" : "warn";
  return {
    name: "setup-skills",
    status: worstStatus,
    message: `Propietarias: ${finalCheck.message} | Lock: ${lockedResult.message}`,
  };
}

// ---------------------------------------------------------------
// Setup: Servidores MCP (Model Context Protocol)
// ------------------------------------------------------------
// Gestiona el archivo .mcp.json que registra los servidores MCP que el
// coding agent (Copilot/VS/VS Code) puede lanzar: codegraph, ado
// (Azure DevOps) y codebase-memory. Este archivo puede vivir a nivel de
// repo (compartido/versionado en git) o a nivel de usuario (~/.mcp.json,
// personal); el usuario elige dónde escribirlo en cada ejecución. La
// escritura siempre hace merge, preservando cualquier otra clave/servidor
// que ya existiera en el fichero.
// ------------------------------------------------------------
async function mcpChooseScope(io) {
  const scope = await io.select("¿Dónde quieres gestionar el .mcp.json?", [
    { name: `A nivel de repo (compartido/versionado: ${MCP_CONFIG_REPO_FILE})`, value: "repo" },
    { name: `A nivel de usuario (personal, no versionado: ${MCP_CONFIG_USER_FILE})`, value: "user" },
    { name: "← Cancelar", value: "cancel" },
  ]);
  if (scope === "cancel") return null;
  return scope === "repo" ? MCP_CONFIG_REPO_FILE : MCP_CONFIG_USER_FILE;
}

function mcpDescribeCurrentConfig(io, filePath) {
  const config = readMcpConfig(filePath);
  const names = Object.keys(config.servers);
  io.log(
    existsSync(filePath)
      ? `ℹ️  ${filePath} existe. Servidores ya configurados: ${names.length ? names.join(", ") : "(ninguno)"}`
      : `ℹ️  ${filePath} no existe todavía; se creará al guardar.`
  );
}

async function setupMcpServerAdo(io) {
  const org = await io.input("Organización de Azure DevOps:", ADO_DEFAULT_ORG);
  return { ado: MCP_SERVER_DEFS.ado.build(org.trim() || ADO_DEFAULT_ORG) };
}

export async function setupMcpServers(io) {
  io.log("\n== Setup: Servidores MCP (codegraph / ado / codebase-memory) ==\n");
  io.log("ℹ️  Registra los servidores MCP en un .mcp.json (fusiona con lo ya existente, sin sobrescribir otras claves).");

  const filePath = await mcpChooseScope(io);
  if (!filePath) {
    return { name: "setup-mcp-servers", status: "warn", message: "Cancelado por el usuario." };
  }
  mcpDescribeCurrentConfig(io, filePath);

  const selected = await io.select("¿Qué servidores quieres añadir/actualizar?", [
    { name: "CodeGraph", value: "codegraph" },
    { name: "Azure DevOps (ado)", value: "ado" },
    { name: "CodeBase memory", value: "codebase-memory" },
    { name: "Los 3", value: "all" },
    { name: "← Cancelar", value: "cancel" },
  ]);
  if (selected === "cancel") {
    return { name: "setup-mcp-servers", status: "warn", message: "Cancelado por el usuario." };
  }

  const names = selected === "all" ? Object.keys(MCP_SERVER_DEFS) : [selected];
  const serversToMerge = {};
  for (const name of names) {
    if (name === "ado") {
      Object.assign(serversToMerge, await setupMcpServerAdo(io));
    } else {
      serversToMerge[name] = MCP_SERVER_DEFS[name].build();
    }
  }

  const result = mergeMcpServers(filePath, serversToMerge);
  if (!result.ok) {
    io.log(`❌ No se pudo escribir ${filePath}: ${result.error}`);
    return { name: "setup-mcp-servers", status: "fail", message: `Falló al escribir ${filePath}.`, hint: result.error };
  }

  const summary = [
    result.added.length ? `añadidos: ${result.added.join(", ")}` : null,
    result.updated.length ? `actualizados: ${result.updated.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  io.log(`✅ ${filePath} actualizado (${summary || "sin cambios"}).`);
  io.log("⚠️  Reinicia el coding agent (Visual Studio / VS Code) para que detecte los servidores MCP nuevos/actualizados.");
  return {
    name: "setup-mcp-servers",
    status: "ok",
    message: `.mcp.json (${filePath === MCP_CONFIG_REPO_FILE ? "repo" : "usuario"}) actualizado: ${summary || "sin cambios"}.`,
    hint: filePath,
  };
}

export async function setupAll(io) {
  const results = [];
  results.push(await setupRtk(io));
  results.push(await setupCodegraph(io));
  results.push(await setupCodebaseMemory(io));
  results.push(await setupSkills(io));
  results.push(await setupMcpServers(io));
  return results;
}
