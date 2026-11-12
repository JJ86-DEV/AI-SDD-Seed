/**
 * file-read.mjs
 * ------------------------------------------------------------
 * Lee un fichero con cache persistente en disco.
 *
 * El cache se mantiene automáticamente: la primera vez que lees
 * un path, se guarda {mtime, size, sha}. Las siguientes veces
 * el script hace stat() y compara con el cache:
 *   - si mtime+size coinciden → { unchanged: true } (sin leer)
 *   - si no → lee, actualiza cache, devuelve contenido
 *
 * El agente no necesita pasar flags ni recordar nada: el cache
 * persiste entre sesiones y entre tools. Funciona como un
 * "memoize" transparente de read_file.
 *
 * Uso:
 *   pnpm run memory:file-read <path>
 *   pnpm run memory:file-read --clear-cache      # vacía el cache
 *   pnpm run memory:file-read --cache-stats      # muestra tamaño
 *   pnpm run memory:file-read --revalidate       # NO requiere <path>
 *      # Recorre TODAS las entradas de la cache. Para cada una:
 *      #   - si el fichero ya no existe → elimina la entrada (stale)
 *      #   - si el contenido en disco difiere del cacheado → re-lee
 *      #     y actualiza mtime/size/sha/content
 *      #   - si coincide → no hace nada
 *      # Pensado para automatizar la verificación cuando mtime/size
 *      # pueden no haber cambiado pero el contenido sí (git checkout,
 *      # touch, restore, sincronizaciones, etc.).
 *      # Imprime resumen JSON apto para scripts:
 *      #   { checked, consistent, updated, missing, entries: [...] }
 * ------------------------------------------------------------
 */

import { readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { resolve, isAbsolute, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const CACHE_FILE = resolve(ROOT, "vectorized", "file-cache.json");

function parseArgs(argv) {
  const args = {
    path: "",
    clearCache: false,
    cacheStats: false,
    revalidate: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue; // separador de pnpm, ignorar
    if (a === "--clear-cache") args.clearCache = true;
    else if (a === "--cache-stats") args.cacheStats = true;
    else if (a === "--revalidate" || a === "--revalidate-cache")
      args.revalidate = true;
    else positional.push(a);
  }
  args.path = positional.join(" ").trim();
  return args;
}

function resolvePath(p) {
  return isAbsolute(p) ? p : resolve(ROOT, p);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Recorre TODAS las entradas de la cache y las revalida contra disco.
 * - fichero desaparecido → elimina la entrada (stale)
 * - sha real difiere del cacheado (o mtime/size cambiaron) → re-lee y actualiza
 * - coincide → conserva la entrada (refresca ts por si acaso)
 *
 * Pensado para invocarse desde un cron / hook / pipeline. Devuelve un
 * resumen JSON apto para scripts: { checked, consistent, updated, missing, entries }.
 */
function revalidateAll() {
  const cache = loadCache();
  const entries = Object.keys(cache);
  let consistent = 0;
  let updated = 0;
  let missing = 0;
  const report = [];

  for (const p of entries) {
    let pStat;
    try {
      if (!existsSync(p)) {
        delete cache[p];
        missing++;
        report.push({ path: p, status: "missing" });
        process.stderr.write(`[file-read] REVALIDATE missing ${p}\n`);
        continue;
      }
      pStat = statSync(p);
    } catch {
      delete cache[p];
      missing++;
      report.push({ path: p, status: "missing" });
      continue;
    }
    if (pStat.isDirectory()) {
      delete cache[p];
      missing++;
      report.push({ path: p, status: "missing" });
      continue;
    }

    const pMtime = pStat.mtimeMs;
    const pSize = pStat.size;
    const entry = cache[p];

    // Releemos siempre para detectar el caso "mtime/size iguales pero
    // contenido distinto" (git checkout, touch, restore, sync).
    const content = readFileSync(p, "utf8");
    const sha = sha256(content);

    if (entry && entry.sha === sha) {
      cache[p] = {
        mtime: pMtime,
        size: pSize,
        sha,
        ts: Date.now(),
        content: entry.content ?? content,
      };
      consistent++;
      report.push({ path: p, status: "consistent", sha });
      process.stderr.write(
        `[file-read] REVALIDATE consistent ${p} sha=${sha.slice(0, 12)}\n`,
      );
    } else {
      const oldSha = entry?.sha ?? null;
      cache[p] = { mtime: pMtime, size: pSize, sha, ts: Date.now(), content };
      updated++;
      report.push({ path: p, status: "updated", oldSha, newSha: sha });
      process.stderr.write(
        `[file-read] REVALIDATE updated   ${p} sha=${oldSha ? oldSha.slice(0, 12) : "null"} -> ${sha.slice(0, 12)}\n`,
      );
    }
  }

  saveCache(cache);
  return {
    checked: entries.length,
    consistent,
    updated,
    missing,
    entries: report,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.clearCache) {
    if (existsSync(CACHE_FILE)) writeFileSync(CACHE_FILE, "{}");
    console.log("✅ Cache vaciado");
    return;
  }

  if (args.cacheStats) {
    const cache = loadCache();
    const entries = Object.keys(cache).length;
    const sizeKb = existsSync(CACHE_FILE)
      ? (readFileSync(CACHE_FILE, "utf8").length / 1024).toFixed(1)
      : "0";
    console.log(
      JSON.stringify(
        { entries, fileSizeKb: sizeKb, path: CACHE_FILE },
        null,
        2,
      ),
    );
    return;
  }

  if (!args.path && !args.revalidate) {
    console.error(
      "Uso: pnpm run memory:file-read <path> [--clear-cache] [--cache-stats] [--revalidate]",
    );
    process.exit(1);
  }

  // --revalidate: bulk, sin necesidad de <path>. Va antes de la
  // validación de path para no fallar cuando se invoca sin argumento.
  if (args.revalidate) {
    const summary = revalidateAll();
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const absPath = resolvePath(args.path);
  if (!existsSync(absPath)) {
    console.error(`❌ No existe: ${absPath}`);
    process.exit(1);
  }

  const stat = statSync(absPath);
  if (stat.isDirectory()) {
    console.error(`❌ Es un directorio, no un fichero: ${absPath}`);
    process.exit(1);
  }

  const mtime = stat.mtimeMs;
  const size = stat.size;

  // Cache check
  const cache = loadCache();
  const cached = cache[absPath];

  if (
    cached &&
    cached.mtime === mtime &&
    cached.size === size &&
    cached.content != null
  ) {
    process.stderr.write(
      `[file-read] HIT  path=${absPath} size=${size} (served from cache, no disk read)\n`,
    );
    console.log(
      JSON.stringify(
        {
          path: absPath,
          sha: cached.sha,
          mtime,
          size,
          fromCache: true,
          content: cached.content,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Cache miss: leemos, actualizamos y devolvemos
  const content = readFileSync(absPath, "utf8");
  const sha = sha256(content);
  cache[absPath] = { mtime, size, sha, ts: Date.now(), content };
  saveCache(cache);

  process.stderr.write(
    `[file-read] MISS path=${absPath} size=${size} (read ${content.length} chars from disk, cached)\n`,
  );

  console.log(
    JSON.stringify(
      { path: absPath, sha, mtime, size, fromCache: false, content },
      null,
      2,
    ),
  );
}

main();
