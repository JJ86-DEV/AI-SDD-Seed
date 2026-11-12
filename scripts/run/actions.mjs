/**
 * actions.mjs (run)
 * ------------------------------------------------------------
 * Acciones de "Run" invocables desde la CLI interactiva
 * (scripts/cli/tooling.mjs) o desde modo argumentos.
 *
 * Igual que scripts/setup/actions.mjs, reciben un objeto `io`
 * con { confirm, log } para no acoplarse a inquirer.
 * ------------------------------------------------------------
 */

import { tryExec, checkCorpusIndex, checkNpmDependencies, readPkg } from "../doctor/checks.mjs";

export async function runVectorize(io) {
  io.log("\n== Run: Indexación del corpus ==\n");
  const before = checkCorpusIndex();
  io.log(`Estado actual: ${before.message}`);

  if (before.status === "ok") {
    const proceed = await io.confirm("El corpus ya está actualizado. ¿Regenerar igualmente?", false);
    if (!proceed) {
      return { name: "run-vectorize", status: "ok", message: "Omitido: ya estaba actualizado." };
    }
  }

  io.log("\n🔧 Ejecutando: pnpm run vectorize:project (puede tardar varios minutos)...\n");
  const res = tryExec("pnpm run vectorize:project", 10 * 60 * 1000);
  if (res.ok) {
    io.log(res.output);
    io.log("\n✅ Corpus regenerado correctamente.");
    return { name: "run-vectorize", status: "ok", message: "Corpus regenerado." };
  }
  io.log(res.output);
  io.log("\n❌ Falló la vectorización.");
  return { name: "run-vectorize", status: "fail", message: "Falló 'vectorize:project'.", hint: res.output };
}

export async function runInstallDeps(io) {
  io.log("\n== Run: Instalación de dependencias node ==\n");
  const pkg = readPkg();
  const before = checkNpmDependencies(pkg);
  io.log(`Estado actual: ${before.message}`);

  if (before.status === "ok") {
    const proceed = await io.confirm("Las dependencias ya están instaladas. ¿Reinstalar igualmente?", false);
    if (!proceed) {
      return { name: "run-install", status: "ok", message: "Omitido: ya estaban instaladas." };
    }
  }

  io.log("\n🔧 Ejecutando: pnpm install ...\n");
  const res = tryExec("pnpm install", 5 * 60 * 1000);
  if (res.ok) {
    io.log(res.output);
    io.log("\n✅ Dependencias instaladas correctamente.");
    return { name: "run-install", status: "ok", message: "Dependencias instaladas." };
  }
  io.log(res.output);
  io.log("\n❌ Falló 'pnpm install'.");
  return { name: "run-install", status: "fail", message: "Falló 'pnpm install'.", hint: res.output };
}

export async function runAll(io) {
  const results = [];
  results.push(await runInstallDeps(io));
  results.push(await runVectorize(io));
  return results;
}

export async function runVectorizeTest(io) {
  io.log("\n== Run: Query de prueba contra el corpus (vectorize:test) ==\n");
  const query = await io.input("Query de prueba (vacío = usa el set de queries por defecto):", "");
  const cmd = query.trim()
    ? `pnpm run vectorize:test -- "${query.trim().replace(/"/g, '\\"')}"`
    : "pnpm run vectorize:test";

  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 2 * 60 * 1000);
  io.log(res.output);
  if (res.ok) {
    return { name: "run-vectorize-test", status: "ok", message: "Query de prueba ejecutada." };
  }
  return { name: "run-vectorize-test", status: "fail", message: "Falló 'vectorize:test'.", hint: res.output };
}

export async function runMemoryLookup(io) {
  io.log("\n== Run: Búsqueda semántica (memory:lookup) ==\n");
  const query = await io.input("Query de búsqueda:", "");
  if (!query.trim()) {
    return { name: "run-memory-lookup", status: "warn", message: "Omitido: query vacía." };
  }
  const cmd = `pnpm run memory:lookup -- "${query.trim().replace(/"/g, '\\"')}" --human`;

  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 60 * 1000);
  io.log(res.output);
  if (res.ok) {
    return { name: "run-memory-lookup", status: "ok", message: "Búsqueda ejecutada." };
  }
  return { name: "run-memory-lookup", status: "fail", message: "Falló 'memory:lookup'.", hint: res.output };
}

export async function runMemoryFileRead(io) {
  io.log("\n== Run: Lectura de fichero con cache (memory:file-read) ==\n");
  const choice = await io.select("¿Qué quieres hacer?", [
    { name: "Leer un fichero (por path)", value: "read" },
    { name: "Ver estadísticas de la cache (--cache-stats)", value: "stats" },
    { name: "Revalidar toda la cache (--revalidate)", value: "revalidate" },
    { name: "Vaciar la cache (--clear-cache)", value: "clear" },
  ]);

  let cmd;
  if (choice === "read") {
    const path = await io.input("Path del fichero a leer (relativo al repo):", "");
    if (!path.trim()) {
      return { name: "run-memory-file-read", status: "warn", message: "Omitido: path vacío." };
    }
    cmd = `pnpm run memory:file-read -- "${path.trim().replace(/"/g, '\\"')}"`;
  } else if (choice === "stats") {
    cmd = "pnpm run memory:file-read -- --cache-stats";
  } else if (choice === "revalidate") {
    cmd = "pnpm run memory:file-read -- --revalidate";
  } else {
    cmd = "pnpm run memory:file-read -- --clear-cache";
  }

  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 60 * 1000);
  io.log(res.output);
  if (res.ok) {
    return { name: "run-memory-file-read", status: "ok", message: "Comando ejecutado." };
  }
  return { name: "run-memory-file-read", status: "fail", message: "Falló 'memory:file-read'.", hint: res.output };
}

export async function runMemorySemanticCache(io) {
  io.log("\n== Run: Cache semántica de prompts (memory:semantic-cache) ==\n");
  const choice = await io.select("¿Qué quieres hacer?", [
    { name: "Ver estadísticas (stats)", value: "stats" },
    { name: "Vaciar la cache (clear)", value: "clear" },
  ]);

  const cmd = `pnpm run memory:semantic-cache -- ${choice}`;
  io.log(`\n🔧 Ejecutando: ${cmd} ...\n`);
  const res = tryExec(cmd, 60 * 1000);
  io.log(res.output);
  if (res.ok) {
    return { name: "run-memory-semantic-cache", status: "ok", message: `Comando '${choice}' ejecutado.` };
  }
  return {
    name: "run-memory-semantic-cache",
    status: "fail",
    message: `Falló 'memory:semantic-cache -- ${choice}'.`,
    hint: res.output,
  };
}
