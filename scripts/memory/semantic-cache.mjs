/**
 * semantic-cache.mjs
 * ------------------------------------------------------------
 * Cache semántica de prompts de usuario en disco.
 *
 * Flujo:
 *  1) Embedea el prompt con bge-m3
 *  2) Calcula bucket LSH (random hyperplanes reproducibles)
 *  3) Busca candidatos en la misma cubeta (o fallback global)
 *  4) Persiste entradas en JSON en vectorized/semantic-cache.json
 *
 * Uso:
 *   pnpm run memory:semantic-cache -- put --prompt "..." --value "..."
 *   pnpm run memory:semantic-cache -- get --prompt "..." --top 3 --threshold 0.9
 *   pnpm run memory:semantic-cache -- stats
 *   pnpm run memory:semantic-cache -- clear
 * ------------------------------------------------------------
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cosineSimilarity, embed } from "../vectorize/embedder.mjs";
import { createLSH } from "../vectorize/lsh.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");

const CACHE_FILE = resolve(ROOT, "vectorized", "semantic-cache.json");
const MODEL_NAME = "Xenova/bge-m3";
const CACHE_VERSION = 1;
const DEFAULT_NUM_BITS = 64;
const DEFAULT_SEED = "seed-semantic-cache-v1";
const DEFAULT_TOP = 3;
const DEFAULT_THRESHOLD = 0.88;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = {
    command: "",
    prompt: "",
    value: "",
    valueFile: "",
    id: "",
    top: DEFAULT_TOP,
    threshold: DEFAULT_THRESHOLD,
    numBits: DEFAULT_NUM_BITS,
    ttlMs: DEFAULT_TTL_MS,
    seed: DEFAULT_SEED,
    scope: "auto",
    metadata: "",
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") continue;

    if (token === "--prompt") args.prompt = argv[++i] ?? "";
    else if (token === "--value") args.value = argv[++i] ?? "";
    else if (token === "--value-file") args.valueFile = argv[++i] ?? "";
    else if (token === "--id") args.id = argv[++i] ?? "";
    else if (token === "--top") args.top = parseInt(argv[++i], 10);
    else if (token === "--threshold") args.threshold = parseFloat(argv[++i]);
    else if (token === "--num-bits") args.numBits = parseInt(argv[++i], 10);
    else if (token === "--ttl-ms") args.ttlMs = parseInt(argv[++i], 10);
    else if (token === "--seed") args.seed = argv[++i] ?? DEFAULT_SEED;
    else if (token === "--scope") args.scope = argv[++i] ?? "auto";
    else if (token === "--metadata") args.metadata = argv[++i] ?? "";
    else positional.push(token);
  }

  args.command = (positional[0] || "").trim();
  return args;
}

function readValueFromFile(pathLike) {
  const filePath = isAbsolute(pathLike) ? pathLike : resolve(ROOT, pathLike);
  if (!existsSync(filePath)) {
    throw new Error(`No existe el fichero de value: ${filePath}`);
  }
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    throw new Error(`--value-file apunta a directorio: ${filePath}`);
  }
  return readFileSync(filePath, "utf8");
}

function parseMetadata(rawMetadata) {
  if (!rawMetadata) return null;
  try {
    const parsed = JSON.parse(rawMetadata);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    throw new Error(
      '--metadata debe ser JSON válido, ej: \'{"route":"/login"}\'',
    );
  }
}

function defaultStore(seed, numBits) {
  return {
    meta: {
      version: CACHE_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: MODEL_NAME,
      seed,
      numBits,
      ttlMs: DEFAULT_TTL_MS,
      dimension: null,
    },
    entries: [],
  };
}

function ensureDirFor(filePath) {
  const parent = dirname(filePath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

function loadStore(seed, numBits) {
  if (!existsSync(CACHE_FILE)) {
    return defaultStore(seed, numBits);
  }

  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    if (!parsed || !Array.isArray(parsed.entries) || !parsed.meta) {
      return defaultStore(seed, numBits);
    }

    if (!Number.isFinite(parsed.meta.ttlMs) || parsed.meta.ttlMs <= 0) {
      parsed.meta.ttlMs = DEFAULT_TTL_MS;
    }

    return parsed;
  } catch {
    return defaultStore(seed, numBits);
  }
}

function saveStore(store) {
  store.meta.updatedAt = new Date().toISOString();
  ensureDirFor(CACHE_FILE);
  writeFileSync(CACHE_FILE, JSON.stringify(store, null, 2));
}

function buildLSHFromStore(store, seedOverride, numBitsOverride) {
  const seed = store.meta.seed || seedOverride;
  const numBits = store.meta.numBits || numBitsOverride;
  const dim = store.meta.dimension;

  if (!dim || dim <= 0) {
    throw new Error(
      "No hay dimensión en cache todavía. Inserta una entrada primero con put.",
    );
  }

  return createLSH(dim, { seed, numBits });
}

function computeStats(store) {
  const buckets = new Map();
  for (const entry of store.entries) {
    buckets.set(entry.bucket, (buckets.get(entry.bucket) || 0) + 1);
  }
  const total = store.entries.length;
  const bucketCount = buckets.size;
  const avgPerBucket = bucketCount > 0 ? total / bucketCount : 0;
  return {
    totalEntries: total,
    totalBuckets: bucketCount,
    avgEntriesPerBucket: Number(avgPerBucket.toFixed(2)),
  };
}

function isEntryExpired(entry, ttlMs, nowMs) {
  if (entry.expiresAt) {
    const expiresAtMs = Date.parse(entry.expiresAt);
    if (Number.isFinite(expiresAtMs)) {
      return nowMs >= expiresAtMs;
    }
  }

  const baseTs = Date.parse(entry.updatedAt || entry.createdAt || "");
  if (!Number.isFinite(baseTs) || ttlMs <= 0) {
    return false;
  }
  return nowMs >= baseTs + ttlMs;
}

function purgeExpiredEntries(store, ttlMs) {
  const nowMs = Date.now();
  const before = store.entries.length;
  store.entries = store.entries.filter(
    (entry) => !isEntryExpired(entry, ttlMs, nowMs),
  );
  return before - store.entries.length;
}

async function commandPut(args) {
  if (!args.prompt || !args.prompt.trim()) {
    throw new Error("put requiere --prompt no vacío");
  }

  const metadata = parseMetadata(args.metadata);
  const value = args.valueFile ? readValueFromFile(args.valueFile) : args.value;
  if (!value || !value.trim()) {
    throw new Error("put requiere --value o --value-file no vacío");
  }

  const store = loadStore(args.seed, args.numBits);
  const promptEmbedding = await embed(args.prompt);
  const dimension = promptEmbedding.length;

  if (!store.meta.dimension) {
    store.meta.dimension = dimension;
    store.meta.seed = args.seed;
    store.meta.numBits = args.numBits;
  }

  if (!Number.isFinite(store.meta.ttlMs) || store.meta.ttlMs <= 0) {
    store.meta.ttlMs = args.ttlMs;
  }

  if (store.meta.dimension !== dimension) {
    throw new Error(
      `Dimensión incompatible: cache=${store.meta.dimension} prompt=${dimension}`,
    );
  }

  const lsh = createLSH(store.meta.dimension, {
    seed: store.meta.seed,
    numBits: store.meta.numBits,
  });

  const embedding = Array.from(promptEmbedding);
  const bucket = lsh.hash(promptEmbedding);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  // Si existe id se reemplaza; si no, append.
  let id = args.id || `prompt-${Date.now()}`;
  const existingIndex = store.entries.findIndex((e) => e.id === id);

  const entry = {
    id,
    prompt: args.prompt,
    value,
    metadata,
    bucket,
    embedding,
    createdAt:
      existingIndex >= 0 ? store.entries[existingIndex].createdAt : now,
    updatedAt: now,
    expiresAt: new Date(nowMs + store.meta.ttlMs).toISOString(),
    lastAccessAt: null,
    hits: existingIndex >= 0 ? store.entries[existingIndex].hits : 0,
  };

  if (existingIndex >= 0) {
    store.entries[existingIndex] = entry;
  } else {
    store.entries.push(entry);
  }

  saveStore(store);
  const stats = computeStats(store);

  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "put",
        path: CACHE_FILE,
        entry: {
          id,
          bucket,
          dimension,
          ttlMs: store.meta.ttlMs,
          expiresAt: entry.expiresAt,
          valueChars: value.length,
          metadata,
        },
        stats,
      },
      null,
      2,
    ),
  );
}

function pickCandidates(store, bucket, scope) {
  if (scope === "global") {
    return { candidates: store.entries, mode: "global" };
  }

  const inBucket = store.entries.filter((entry) => entry.bucket === bucket);
  if (scope === "bucket") {
    return { candidates: inBucket, mode: "bucket" };
  }

  if (inBucket.length > 0) {
    return { candidates: inBucket, mode: "bucket" };
  }
  return { candidates: store.entries, mode: "global-fallback" };
}

async function commandGet(args) {
  if (!args.prompt || !args.prompt.trim()) {
    throw new Error("get requiere --prompt no vacío");
  }

  if (!["auto", "bucket", "global"].includes(args.scope)) {
    throw new Error("--scope debe ser uno de: auto | bucket | global");
  }

  const store = loadStore(args.seed, args.numBits);
  const purgedExpired = purgeExpiredEntries(store, store.meta.ttlMs);
  if (purgedExpired > 0) {
    saveStore(store);
  }

  if (store.entries.length === 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          command: "get",
          path: CACHE_FILE,
          hit: false,
          reason: purgedExpired > 0 ? "all-expired" : "empty-cache",
          results: [],
        },
        null,
        2,
      ),
    );
    return;
  }

  const queryEmbedding = await embed(args.prompt);
  if (store.meta.dimension && store.meta.dimension !== queryEmbedding.length) {
    throw new Error(
      `Dimensión incompatible: cache=${store.meta.dimension} query=${queryEmbedding.length}`,
    );
  }

  const lsh = buildLSHFromStore(store, args.seed, args.numBits);
  const bucket = lsh.hash(queryEmbedding);

  const { candidates, mode } = pickCandidates(store, bucket, args.scope);
  const ranked = candidates
    .map((entry) => ({
      entry,
      score: cosineSimilarity(
        queryEmbedding,
        new Float32Array(entry.embedding),
      ),
    }))
    .filter((item) => item.score >= args.threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, args.top));

  const now = new Date().toISOString();
  for (const item of ranked) {
    const found = store.entries.find((entry) => entry.id === item.entry.id);
    if (found) {
      found.hits = (found.hits || 0) + 1;
      found.lastAccessAt = now;
    }
  }
  saveStore(store);

  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "get",
        path: CACHE_FILE,
        hit: ranked.length > 0,
        mode,
        bucket,
        threshold: args.threshold,
        ttlMs: store.meta.ttlMs,
        top: args.top,
        results: ranked.map((item) => ({
          id: item.entry.id,
          score: Number(item.score.toFixed(6)),
          bucket: item.entry.bucket,
          prompt: item.entry.prompt,
          value: item.entry.value,
          metadata: item.entry.metadata,
          hits: item.entry.hits,
          expiresAt: item.entry.expiresAt,
          updatedAt: item.entry.updatedAt,
        })),
      },
      null,
      2,
    ),
  );
}

function commandStats(args) {
  const store = loadStore(args.seed, args.numBits);
  const purgedExpired = purgeExpiredEntries(store, store.meta.ttlMs);
  if (purgedExpired > 0) {
    saveStore(store);
  }
  const stats = computeStats(store);
  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "stats",
        path: CACHE_FILE,
        meta: store.meta,
        purgedExpired,
        stats,
      },
      null,
      2,
    ),
  );
}

function commandClear(args) {
  const empty = defaultStore(args.seed, args.numBits);
  saveStore(empty);
  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "clear",
        path: CACHE_FILE,
      },
      null,
      2,
    ),
  );
}

function printHelp() {
  console.log(`
Uso:
  pnpm run memory:semantic-cache -- <comando> [flags]

Comandos:
  put     Inserta/actualiza una entrada en cache
  get     Busca entradas similares por LSH + cosine
  stats   Muestra métricas de cache
  clear   Resetea el fichero de cache

Flags comunes:
  --prompt "..."            Prompt de usuario
  --top 3                   Resultados máximos en get (default: 3)
  --threshold 0.88          Similaridad mínima en get (default: 0.88)
  --scope auto|bucket|global Modo de candidatos (default: auto)
  --num-bits 64             Bits del hash LSH
  --ttl-ms 86400000         TTL por defecto en ms (default: 24h)
  --seed "..."              Semilla reproducible LSH

Flags de put:
  --value "..."             Valor cacheado (ej: respuesta serializada)
  --value-file ./path.txt   Lee valor desde fichero
  --id cache-key            Id explícito para upsert
  --metadata '{"k":"v"}'   JSON opcional
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.command.toLowerCase();

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (Number.isNaN(args.top) || args.top <= 0) {
    throw new Error("--top debe ser un entero > 0");
  }
  if (
    Number.isNaN(args.threshold) ||
    args.threshold < -1 ||
    args.threshold > 1
  ) {
    throw new Error("--threshold debe estar en [-1, 1]");
  }
  if (Number.isNaN(args.numBits) || args.numBits <= 0) {
    throw new Error("--num-bits debe ser entero > 0");
  }
  if (Number.isNaN(args.ttlMs) || args.ttlMs <= 0) {
    throw new Error("--ttl-ms debe ser entero > 0");
  }

  if (command === "put") await commandPut(args);
  else if (command === "get") await commandGet(args);
  else if (command === "stats") commandStats(args);
  else if (command === "clear") commandClear(args);
  else {
    throw new Error(`Comando no soportado: ${command}`);
  }
}

main().catch((err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
