/**
 * test-query.mjs
 * ------------------------------------------------------------
 * Query de prueba contra el corpus vectorizado.
 *
 * Uso:
 *   pnpm run vectorize:test
 *   pnpm run vectorize:test -- "regla de dependencias Clean Architecture"
 * ------------------------------------------------------------
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { embed, cosineSimilarity, getModel } from "./embedder.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const CORPUS_FILE = join(ROOT, "vectorized", "corpus.json");

const QUERIES_DEFAULT = [
  "Regla de dependencias en Clean Architecture",
  "Dónde van los DTOs y la pureza del Domain",
  "Convenciones de EF Core y DbContext",
  "Inyección de dependencias por constructor en .NET",
  "Versionado de API y Swagger",
  "Convenciones de naming y XML docs",
  "Restricciones duras de arquitectura del proyecto",
];

async function main() {
  const userQuery = process.argv.slice(2).join(" ").trim();
  const queries = userQuery ? [userQuery] : QUERIES_DEFAULT;

  if (!existsSync(CORPUS_FILE)) {
    console.error(`❌ No existe ${CORPUS_FILE}`);
    console.error("   Ejecuta primero: ppnpm run vectorize:project");
    process.exit(1);
  }

  console.log("📦 Cargando corpus vectorizado...");
  const corpus = JSON.parse(readFileSync(CORPUS_FILE, "utf8"));
  console.log(
    `   ${corpus.meta.totalChunks} chunks en ${corpus.meta.totalBuckets} cubetas`,
  );
  console.log(
    `   Dimensión: ${corpus.meta.dimension}, bits: ${corpus.meta.numBits}`,
  );

  console.log("\n🧠 Cargando modelo de embeddings...");
  await getModel(); // warm-up

  // Con corpus pequeño (< 100 docs), brute-force cosine es más preciso
  // y más rápido que LSH. LSH brilla con 10K+ docs.
  console.log("   Modo: brute-force cosine (corpus pequeño)");

  console.log(`\n🔍 Ejecutando ${queries.length} query(s)...\n`);

  for (const query of queries) {
    console.log(`━━━ Query: "${query}" ━━━`);

    const queryVec = await embed(query);

    // Brute-force: cosine contra TODO el corpus
    const scored = corpus.documents.map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryVec, new Float32Array(doc.embedding)),
    }));

    scored.sort((a, b) => b.score - a.score);

    console.log("   Top 3 resultados:");
    for (const result of scored.slice(0, 3)) {
      const pct = (result.score * 100).toFixed(1);
      const sec = result.section ? ` › ${result.section}` : "";
      console.log(`     [${pct}%] ${result.id}${sec}`);
    }
    console.log("");
  }

  console.log("✅ Test completado.");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
