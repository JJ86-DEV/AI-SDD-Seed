/**
 * lookup.mjs
 * ------------------------------------------------------------
 * Búsqueda semántica contra el corpus vectorizado.
 *
 * Devuelve los chunks más relevantes. NO devuelve el texto —
 * el agente hace `read_file` sobre el `path` si quiere detalle.
 *
 * Uso:
 *   node scripts/memory/lookup.mjs "tu query aquí"
 *   node scripts/memory/lookup.mjs "tu query" --top 5
 *   node scripts/memory/lookup.mjs "tu query" --human
 *   node scripts/memory/lookup.mjs "tu query" --threshold 0.4
 * ------------------------------------------------------------
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { embed, cosineSimilarity, getModel } from "../vectorize/embedder.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const CORPUS_FILE = join(ROOT, "vectorized", "corpus.json");

function parseArgs(argv) {
  const args = { query: "", top: 3, human: false, threshold: 0.5 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--top") args.top = parseInt(argv[++i], 10);
    else if (a === "--human") args.human = true;
    else if (a === "--threshold") args.threshold = parseFloat(argv[++i]);
    else positional.push(a);
  }
  args.query = positional.join(" ").trim();
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.query) {
    console.error(
      'Uso: node scripts/memory/lookup.mjs "tu query" [--top N] [--human] [--threshold 0.5]',
    );
    process.exit(1);
  }

  if (!existsSync(CORPUS_FILE)) {
    console.error(`❌ No existe ${CORPUS_FILE}`);
    console.error("   Ejecuta primero: pnpm run vectorize:project");
    process.exit(1);
  }

  const corpus = JSON.parse(readFileSync(CORPUS_FILE, "utf8"));
  await getModel();

  const queryVec = await embed(args.query);

  const scored = corpus.documents
    .map((doc) => ({
      id: doc.id,
      source: doc.source,
      path: doc.path,
      section: doc.section,
      score:
        cosineSimilarity(queryVec, new Float32Array(doc.embedding)) *
        (doc.priority === "high" ? 1.5 : 1.0),
    }))
    .filter((d) => d.score >= args.threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.top);

  // Métricas a stderr (no contaminan stdout que el agente parsea)
  process.stderr.write(
    `[lookup] query="${args.query.slice(0, 40)}" hits=${scored.length}/${corpus.documents.length} topScore=${scored[0]?.score.toFixed(3) ?? "n/a"} threshold=${args.threshold}\n`,
  );

  if (args.human) {
    console.log(`\n━━━ Query: "${args.query}" ━━━`);
    for (const r of scored) {
      const pct = (r.score * 100).toFixed(1);
      const sec = r.section ? ` › ${r.section}` : "";
      console.log(`\n  [${pct}%] ${r.id}${sec}`);
      console.log(`         path: ${r.path}`);
    }
    console.log("");
  } else {
    console.log(
      JSON.stringify({ query: args.query, results: scored }, null, 2),
    );
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
