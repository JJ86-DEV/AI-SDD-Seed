/**
 * checks.mjs
 * ------------------------------------------------------------
 * Checks puros de entorno (sin lógica de CLI). Cada función
 * devuelve { name, status: 'ok'|'warn'|'fail'|'pending-deep', message, hint }.
 *
 * Reutilizado por:
 *   - scripts/doctor/check-environment.mjs (modo doctor, no interactivo)
 *   - scripts/cli/tooling.mjs (CLI "AI-SDD Tooling")
 * ------------------------------------------------------------
 */

import { readFileSync, existsSync, statSync, readdirSync, openSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const ROOT = resolve(__dirname, "..", "..");

export const PKG_FILE = join(ROOT, "package.json");
export const CONFIG_FILE = join(ROOT, ".agents", "config.json");
export const SKILLS_DIR = join(ROOT, ".agents", "skills");
export const DOCS_DIR = join(ROOT, "docs");
export const VECTORIZED_DIR = join(ROOT, "vectorized");
export const CORPUS_FILE = join(VECTORIZED_DIR, "corpus.json");
export const FILE_CACHE_FILE = join(VECTORIZED_DIR, "file-cache.json");

export const EXPECTED_SKILLS = [
  "codebase-memory-mcp",
  "codegraph-architecture-agent",
  "dotnet-best-practices",
  "ef-core",
  "memory-file-read",
  "memory-lookup",
  "memory-semantic-cache",
];

export const RTK_REPO_URL = "https://github.com/rtk-ai/rtk";
export const RTK_WINGET_ID = "rtk-ai.rtk";

export const CODEGRAPH_REPO_URL = "https://github.com/colbymchenry/codegraph";
export const CODEGRAPH_INSTALL_PS1_URL =
  "https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1";

export const CODEBASE_MEMORY_REPO_URL = "https://github.com/DeusData/codebase-memory-mcp";
export const CODEBASE_MEMORY_INSTALL_PS1_URL =
  "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1";
export const CODEBASE_MEMORY_UI_PORT = 9749;

export const SKILLS_LOCK_FILE = join(ROOT, "skills-lock.json");

// ---------------------------------------------------------------
// MCP (Model Context Protocol) servers
// ---------------------------------------------------------------
// El archivo .mcp.json puede vivir a nivel de repo (compartido/versionado
// en git) o a nivel de usuario (~/.mcp.json, personal). La tooling permite
// elegir dónde gestionarlo; nunca asume uno de los dos por defecto.
export const MCP_CONFIG_REPO_FILE = join(ROOT, ".mcp.json");
export const MCP_CONFIG_USER_FILE = join(homedir(), ".mcp.json");

export const ADO_DEFAULT_ORG = "<ORGANIZACION_ADO>";

/**
 * Definiciones de los servidores MCP que la tooling sabe configurar.
 * Cada entrada es una función porque "ado" necesita interpolar la
 * organización (parametrizable, con fallback a ADO_DEFAULT_ORG).
 */
export const MCP_SERVER_DEFS = {
  codegraph: {
    label: "CodeGraph (code-graph local vía CLI)",
    build: () => ({ type: "stdio", command: "codegraph", args: ["serve", "--mcp"] }),
  },
  "codebase-memory": {
    label: "CodeBase memory (servidor MCP de knowledge graph)",
    build: () => ({ type: "stdio", command: "codebase-memory-mcp", args: [] }),
  },
  ado: {
    label: "Azure DevOps (consultas a ADO vía @azure-devops/mcp)",
    build: (org = ADO_DEFAULT_ORG) => ({
      type: "stdio",
      command: "npx",
      args: ["-y", "@azure-devops/mcp", org],
      env: {},
    }),
  },
};

/** Lee y parsea un .mcp.json existente; devuelve una config vacía si no existe o está corrupto. */
export function readMcpConfig(filePath) {
  if (!existsSync(filePath)) {
    return { inputs: [], servers: {} };
  }
  try {
    const parsed = readJson(filePath);
    return {
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      servers: parsed.servers && typeof parsed.servers === "object" ? parsed.servers : {},
    };
  } catch {
    return { inputs: [], servers: {} };
  }
}

/**
 * Fusiona (merge) uno o varios servidores MCP dentro de un .mcp.json
 * existente, preservando cualquier otra clave que el usuario ya tuviera
 * configurada. Devuelve { ok, path, added, updated }.
 */
export function mergeMcpServers(filePath, serversToMerge) {
  try {
    const config = readMcpConfig(filePath);
    const added = [];
    const updated = [];
    for (const [name, def] of Object.entries(serversToMerge)) {
      if (config.servers[name]) updated.push(name);
      else added.push(name);
      config.servers[name] = def;
    }
    writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
    return { ok: true, path: filePath, added, updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Devuelve un enlace clicable usando la secuencia de escape OSC 8,
 * soportada por terminales modernos (Windows Terminal, VS Code
 * integrated terminal, iTerm2, etc.). En terminales sin soporte, la
 * secuencia se ignora silenciosamente y solo se ve el texto.
 */
export function hyperlink(url, text = url) {
  const OSC = "\u001B]8;;";
  const BEL = "\u0007";
  return `${OSC}${url}${BEL}${text}${OSC}${BEL}`;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readPkg() {
  return readJson(PKG_FILE);
}

export function tryExec(cmd, timeoutMs = 8000) {
  try {
    const out = execSync(cmd, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      windowsHide: true,
    });
    return { ok: true, output: out.toString().trim() };
  } catch (err) {
    return { ok: false, output: (err.stdout?.toString() ?? err.message).trim() };
  }
}

/**
 * Igual que tryExec, pero recibe el binario y sus argumentos como array
 * (execFileSync), evitando problemas de escaping de comillas/backslashes
 * en cmd.exe/PowerShell cuando se pasan argumentos con JSON o espacios.
 */
export function tryExecArgs(file, args, timeoutMs = 8000) {
  try {
    const out = execFileSync(file, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      windowsHide: true,
    });
    return { ok: true, output: out.toString().trim() };
  } catch (err) {
    return { ok: false, output: (err.stdout?.toString() ?? err.message).trim() };
  }
}

/**
 * Lanza un proceso desacoplado (detached) que sigue vivo tras salir de la
 * CLI, redirigiendo su stdout/stderr a un fichero de log. Útil para
 * servicios de larga duración como la UI de codebase-memory-mcp.
 *
 * NOTA (Windows): tanto `child_process.spawn` con `detached:true` como
 * `Start-Process` de PowerShell lanzado vía `execFileSync` desde Node NO
 * mantienen vivo el proceso hijo en este entorno: el proceso Node de la
 * CLI corre dentro de un Job Object (heredado de la terminal/proceso
 * padre) con el flag "kill on job close", y cualquier proceso hijo
 * (incluido el nieto lanzado por PowerShell) queda atado al mismo Job
 * Object y muere con él. Se comprobó empíricamente que únicamente
 * `Win32_Process.Create` vía WMI crea el proceso fuera de dicho Job
 * Object (lo crea el servicio WMI, no el árbol de la terminal), por lo
 * que en Windows delegamos el lanzamiento a WMI.
 * Devuelve { ok, pid, logFile } o { ok: false, error }.
 */
export function spawnDetached(file, args, logFile) {
  try {
    if (process.platform === "win32") {
      const cwd = process.cwd();
      const absLogFile = resolve(cwd, logFile);
      const cmdLine = `cmd.exe /c ${file} ${args.join(" ")} > "${absLogFile}" 2>&1`;
      const psCmd =
        "(Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='" +
        cmdLine.replace(/'/g, "''") +
        "'; CurrentDirectory='" +
        cwd.replace(/'/g, "''") +
        "'}).ProcessId";
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCmd], {
        encoding: "utf8",
      });
      const pid = parseInt(out.trim(), 10);
      return { ok: true, pid: Number.isNaN(pid) ? null : pid, logFile: absLogFile };
    }

    const fd = openSync(logFile, "a");
    const child = spawn(file, args, {
      detached: true,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
    child.unref();
    return { ok: true, pid: child.pid, logFile };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function result(name, status, message, hint) {
  return { name, status, message, hint: hint ?? null };
}

/** Devuelve el mtime más reciente entre todos los .md bajo un directorio (recursivo). */
export function latestMtime(dir) {
  if (!existsSync(dir)) return 0;
  let latest = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const mtime = statSync(full).mtimeMs;
        if (mtime > latest) latest = mtime;
      }
    }
  }
  return latest;
}

export function checkNode(pkg) {
  const required = (pkg.engines?.node ?? ">=18").replace(/[^\d.]/g, "");
  const requiredMajor = parseInt(required.split(".")[0] || "18", 10);
  const currentMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (currentMajor >= requiredMajor) {
    return result(
      "Node.js",
      "ok",
      `v${process.versions.node} (requisito: ${pkg.engines?.node ?? ">=18"})`
    );
  }
  return result(
    "Node.js",
    "fail",
    `v${process.versions.node} no cumple el requisito ${pkg.engines?.node ?? ">=18"}`,
    "Instala Node.js >= 18 desde https://nodejs.org/ (o usa nvm-windows)."
  );
}

export function checkPnpm(pkg) {
  const expected = pkg.packageManager?.split("@")[1];
  const res = tryExec("pnpm -v");
  if (!res.ok) {
    return result(
      "pnpm",
      "fail",
      "No se encontró pnpm en el PATH.",
      "Instala pnpm: 'npm install -g pnpm' o 'corepack enable'."
    );
  }
  const version = res.output;
  if (expected && version !== expected) {
    return result(
      "pnpm",
      "warn",
      `Versión instalada: ${version} (fijada en package.json: ${expected})`,
      `Alinea la versión: 'npm install -g pnpm@${expected}' o 'corepack use pnpm@${expected}'.`
    );
  }
  return result("pnpm", "ok", `v${version}`);
}

/** ¿Está rtk en el PATH? No conocemos su ubicación exacta, solo confirmamos disponibilidad. */
export function checkRtk() {
  const cmd = process.platform === "win32" ? "where rtk" : "which rtk";
  const res = tryExec(cmd);
  if (res.ok && res.output) {
    return result("rtk", "ok", "Instalado y disponible en PATH.");
  }
  return result(
    "rtk",
    "fail",
    "El ejecutable 'rtk' no está en el PATH.",
    `Instálalo siguiendo la guía oficial: ${RTK_REPO_URL} (Windows: 'winget install ${RTK_WINGET_ID}'). ` +
      "Es obligatorio: todo comando de shell lanzado por un agente debe llevar el prefijo 'rtk'."
  );
}

export function checkCodeGraphProvider() {
  if (!existsSync(CONFIG_FILE)) {
    return result(
      "Proveedor code-graph (.agents/config.json)",
      "fail",
      "No existe .agents/config.json.",
      "Crea el fichero de configuración con 'codeGraphProvider' definido."
    );
  }
  const config = readJson(CONFIG_FILE);
  const provider = config.codeGraphProvider;
  if (!provider) {
    return result(
      "Proveedor code-graph",
      "fail",
      "'codeGraphProvider' no está definido en .agents/config.json."
    );
  }

  if (provider === "codebase-memory-mcp") {
    return result(
      "Proveedor code-graph",
      "warn",
      `Activo: '${provider}' (servidor MCP). No se puede verificar desde Node si el host (VS/VS Code) tiene el MCP server habilitado.`,
      "Verifica manualmente o usa 'Setup > CodeBase memory' en la CLI para ver instrucciones por IDE."
    );
  }

  if (provider === "codegraph") {
    return {
      name: "Proveedor code-graph",
      status: "pending-deep",
      message: `Activo: '${provider}' (CLI)`,
      provider,
      hint: null,
    };
  }

  return result(
    "Proveedor code-graph",
    "warn",
    `Valor desconocido: '${provider}'`,
    "Usa 'codebase-memory-mcp' o 'codegraph'."
  );
}

export function checkCodegraphCli(deep) {
  if (!deep) {
    return result(
      "codegraph CLI (fallback)",
      "warn",
      "No verificado (requiere --deep, puede descargar el paquete).",
      "Ejecuta con --deep, o manualmente: 'rtk pnpm dlx @colbymchenry/codegraph status'."
    );
  }
  const res = tryExec("pnpm dlx @colbymchenry/codegraph status", 30000);
  if (res.ok) {
    return result("codegraph CLI (fallback)", "ok", "Responde correctamente a 'status'.");
  }
  return result(
    "codegraph CLI (fallback)",
    "fail",
    "El CLI no respondió correctamente.",
    "Ejecuta 'rtk pnpm dlx @colbymchenry/codegraph init' para indexar."
  );
}

/** ¿El binario 'codegraph' está instalado y disponible en el PATH? */
export function isCodegraphInstalled() {
  const cmd = process.platform === "win32" ? "where codegraph" : "which codegraph";
  const res = tryExec(cmd);
  return res.ok && !!res.output;
}

/** ¿El binario/daemon 'codebase-memory-mcp' está instalado y disponible en el PATH? */
export function isCodebaseMemoryInstalled() {
  const cmd = process.platform === "win32" ? "where codebase-memory-mcp" : "which codebase-memory-mcp";
  const res = tryExec(cmd);
  return res.ok && !!res.output;
}

/** Consulta el estado de auto_index del daemon codebase-memory-mcp (best-effort). */
export function getCodebaseMemoryAutoIndexStatus() {
  const res = tryExecArgs("codebase-memory-mcp", ["config", "get", "auto_index"], 10000);
  if (!res.ok) return { known: false, enabled: null, raw: res.output };
  const normalized = res.output.toLowerCase();
  if (normalized.includes("true")) {
    return { known: true, enabled: true, raw: res.output };
  }
  if (normalized.includes("false")) {
    return { known: true, enabled: false, raw: res.output };
  }
  return { known: false, enabled: null, raw: res.output };
}


/**
 * Valida (de forma ligera, sin dependencias externas) el frontmatter YAML
 * de un SKILL.md: exige un bloque `---\n...\n---` al inicio y detecta el
 * error más común en este repo: un valor "plano" (sin comillas ni bloque
 * `>-`/`|-`) que contiene una secuencia ": " (dos puntos + espacio), lo cual
 * YAML interpreta como el inicio de un mapeo anidado y produce
 * "found invalid mapping" al parsear.
 *
 * Devuelve `null` si el frontmatter es válido, o un string describiendo el
 * problema si no lo es.
 */
export function validateSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return "no tiene bloque frontmatter '---' válido al inicio del fichero.";
  }
  const lines = match[1].split(/\r?\n/);
  let idx = 0;
  while (idx < lines.length) {
    const line = lines[idx];
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (!keyMatch) {
      idx += 1;
      continue;
    }
    const [, key, rawValue] = keyMatch;
    const value = rawValue.trim();
    // Bloques de estilo literal/plegado (>-, >, |-, |) o valores ya citados
    // consumen las líneas siguientes indentadas sin riesgo de romper el
    // parseo con ": " interno, así que se saltan sin analizar su contenido.
    const isBlockScalar = /^[>|][+-]?\d*$/.test(value);
    const isQuoted = /^"(?:[^"\\]|\\.)*"$/.test(value) || /^'(?:[^']|'')*'$/.test(value);
    if (value !== "" && !isBlockScalar && !isQuoted && value.includes(": ")) {
      return `la clave "${key}:" (línea ${idx + 2}) es un valor plano sin comillas que contiene ": ", lo que rompe el YAML ("found invalid mapping"). Usa 'description: >-' con el texto indentado en la línea siguiente, o entrecomilla todo el valor.`;
    }
    idx += 1;
    if (isBlockScalar) {
      // Avanza mientras las líneas siguientes estén indentadas (parte del bloque).
      while (idx < lines.length && (lines[idx] === "" || /^\s+/.test(lines[idx]))) {
        idx += 1;
      }
    }
  }
  return null;
}

export function checkSkills() {
  if (!existsSync(SKILLS_DIR)) {
    return result(
      "Skills básicas",
      "fail",
      "No existe .agents/skills/.",
      "Restaura el directorio de skills desde el repositorio."
    );
  }
  const missing = [];
  const empty = [];
  const invalidYaml = [];
  for (const skill of EXPECTED_SKILLS) {
    const skillFile = join(SKILLS_DIR, skill, "SKILL.md");
    if (!existsSync(skillFile)) {
      missing.push(skill);
      continue;
    }
    if (statSync(skillFile).size === 0) {
      empty.push(skill);
      continue;
    }
    const content = readFileSync(skillFile, "utf8");
    const yamlError = validateSkillFrontmatter(content);
    if (yamlError) invalidYaml.push(`${skill} (${yamlError})`);
  }
  if (missing.length === 0 && empty.length === 0 && invalidYaml.length === 0) {
    return result("Skills básicas", "ok", `${EXPECTED_SKILLS.length}/${EXPECTED_SKILLS.length} skills presentes.`);
  }
  const parts = [];
  if (missing.length) parts.push(`faltan: ${missing.join(", ")}`);
  if (empty.length) parts.push(`vacías: ${empty.join(", ")}`);
  if (invalidYaml.length) parts.push(`frontmatter YAML inválido: ${invalidYaml.join("; ")}`);
  return result(
    "Skills básicas",
    "fail",
    parts.join(" | "),
    "Restaura las skills desde el repo remoto ('git checkout .agents/skills') o corrige el frontmatter YAML señalado."
  );
}

export function checkNpmDependencies(pkg) {
  const nodeModules = join(ROOT, "node_modules");
  if (!existsSync(nodeModules)) {
    return result(
      "Dependencias npm",
      "fail",
      "No existe node_modules/.",
      "Ejecuta 'pnpm install' en la raíz del proyecto."
    );
  }
  const missingDeps = [];
  for (const dep of Object.keys(pkg.devDependencies ?? {})) {
    if (!existsSync(join(nodeModules, dep))) missingDeps.push(dep);
  }
  if (missingDeps.length === 0) {
    return result("Dependencias npm", "ok", "Todas las devDependencies están instaladas.");
  }
  return result(
    "Dependencias npm",
    "fail",
    `Faltan: ${missingDeps.join(", ")}`,
    "Ejecuta 'pnpm install' en la raíz del proyecto."
  );
}

export function checkCorpusIndex() {
  if (!existsSync(CORPUS_FILE)) {
    return result(
      "Índice vectorizado (corpus.json)",
      "fail",
      "No existe vectorized/corpus.json. El proyecto nunca ha sido vectorizado.",
      "Ejecuta 'rtk pnpm run vectorize:project'."
    );
  }
  const corpusMtime = statSync(CORPUS_FILE).mtimeMs;
  const sourcesMtime = Math.max(latestMtime(DOCS_DIR), latestMtime(SKILLS_DIR));
  if (sourcesMtime > corpusMtime) {
    const staleDays = ((sourcesMtime - corpusMtime) / 86400000).toFixed(1);
    return result(
      "Índice vectorizado (corpus.json)",
      "warn",
      `Desactualizado: hay docs/skills modificados ~${staleDays} días después del último índice.`,
      "Ejecuta 'rtk pnpm run vectorize:project' para regenerar el corpus."
    );
  }
  const sizeKb = (statSync(CORPUS_FILE).size / 1024).toFixed(1);
  return result("Índice vectorizado (corpus.json)", "ok", `Presente y actualizado (${sizeKb} KB).`);
}

export function checkFileCache() {
  if (!existsSync(FILE_CACHE_FILE)) {
    return result(
      "Caché de ficheros (file-cache.json)",
      "warn",
      "No existe todavía (se crea automáticamente en el primer 'memory:file-read').",
      "Informativo, no bloqueante."
    );
  }
  const sizeKb = (statSync(FILE_CACHE_FILE).size / 1024).toFixed(1);
  return result("Caché de ficheros (file-cache.json)", "ok", `Presente (${sizeKb} KB).`);
}

/** Ejecuta la batería completa de checks y devuelve el array de resultados. */
export function runAllChecks({ deep = false } = {}) {
  const pkg = readPkg();
  const checks = [];
  checks.push(checkNode(pkg));
  checks.push(checkPnpm(pkg));
  checks.push(checkRtk());

  const providerCheck = checkCodeGraphProvider();
  if (providerCheck.status === "pending-deep") {
    checks.push(checkCodegraphCli(deep));
    checks.push(result("Proveedor code-graph", "ok", providerCheck.message));
  } else {
    checks.push(providerCheck);
  }

  checks.push(checkSkills());
  checks.push(checkNpmDependencies(pkg));
  checks.push(checkCorpusIndex());
  checks.push(checkFileCache());

  return checks;
}

export function statusRank(status) {
  return { fail: 0, warn: 1, ok: 2, "pending-deep": 1 }[status] ?? 1;
}

export const ICONS = { ok: "✅", warn: "⚠️ ", fail: "❌" };

export function printChecks(checks) {
  for (const c of checks) {
    const icon = ICONS[c.status] ?? "•";
    console.log(`${icon} ${c.name}: ${c.message}`);
    if (c.hint && c.status !== "ok") {
      console.log(`   ↳ ${c.hint}`);
    }
  }
}
