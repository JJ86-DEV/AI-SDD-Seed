/**
 * index.mjs
 * ------------------------------------------------------------
 * Vectoriza el corpus del proyecto y guarda el índice en JSON.
 *
 * Filosofía: embedemos documentos COMPLETOS (no summaries) para
 * preservar todo el detalle. Se chunkifica por secciones `## `
 * para mantener precisión dentro de docs largos. bge-m3 aguanta
 * 8192 tokens por chunk (~30000 chars).
 *
 * Fuentes del corpus (descubrimiento DINÁMICO, sin lista hardcodeada):
 *   CAPA 1 · Docs   → todos los `docs/**\/*.md`
 *   CAPA 2 · Skills → todos los `.agents/skills/*\/SKILL.md`
 *
 * Prioridad: un doc puede marcarse como crítico con frontmatter
 * YAML `priority: high` al inicio del fichero. Esos chunks se
 * multiplican ×1.5 en `lookup.mjs` antes de ordenar.
 *
 * Uso:
 *   node scripts/vectorize/index.mjs
 *   pnpm run vectorize:project
 * ------------------------------------------------------------
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { embedBatch } from "./embedder.mjs";
import { createLSH } from "./lsh.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const DOCS_DIR = join(ROOT, "docs");
const SKILLS_DIR = join(ROOT, ".agents", "skills");
const OUTPUT_DIR = join(ROOT, "vectorized");
const OUTPUT_FILE = join(OUTPUT_DIR, "corpus.json");
const SEED = "seed-net-vector-cache-v1";

/**
 * Trunca el texto a un máximo de caracteres para embeddings.
 * bge-m3 aguanta 8192 tokens (~30000 chars).
 */
function truncate(text, maxChars = 30000) {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.substring(0, half) +
    "\n\n[... trunco medio ...]\n\n" +
    text.substring(text.length - half)
  );
}

/**
 * Extrae frontmatter YAML ligero (`---` ... `---`) del inicio del doc.
 * Solo parsea pares `key: value` de primer nivel (suficiente para
 * `priority`). Devuelve { meta, body } donde `body` es el texto sin
 * el bloque de frontmatter (para no contaminar el embedding).
 */
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return { meta: {}, body: text };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { meta: {}, body: text };

  const meta = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key) meta[key] = value;
  }

  const body = lines.slice(end + 1).join("\n").trim();
  return { meta, body };
}

/**
 * Divide un documento en chunks por secciones `## `.
 * Devuelve [{ title, text }].
 * - Si el doc no tiene `## `, devuelve un solo chunk con todo.
 * - Si una sección queda vacía, se descarta.
 */
function chunkBySections(text) {
  const lines = text.split("\n");
  const chunks = [];
  let current = { title: null, lines: [] };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.lines.length > 0) {
        chunks.push({
          title: current.title,
          text: current.lines.join("\n").trim(),
        });
      }
      current = { title: line.replace(/^##\s+/, "").trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.length > 0) {
    chunks.push({
      title: current.title,
      text: current.lines.join("\n").trim(),
    });
  }

  return chunks.filter((c) => c.text.length > 0);
}

/**
 * Recorre un directorio recursivamente y devuelve todos los ficheros
 * cuyo nombre cumple el predicado `match(name)`.
 */
function walk(dir, match, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, match, acc);
    } else if (match(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** id estable relativo al ROOT con separadores POSIX. */
function relId(absPath) {
  return relative(ROOT, absPath).split(sep).join("/");
}

/**
 * Añade un fichero .md al corpus, chunkificado por `## ` y con la
 * prioridad extraída de su frontmatter.
 */
function pushDoc(corpus, absPath, source, baseId) {
  const raw = readFileSync(absPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const priority = meta.priority === "high" ? "high" : null;
  const sections = chunkBySections(body);
  if (sections.length === 0) return 0;

  if (sections.length === 1 && sections[0].title === null) {
    corpus.push({
      id: baseId,
      source,
      path: absPath,
      priority,
      section: null,
      text: sections[0].text,
    });
  } else {
    sections.forEach((sec, idx) => {
      corpus.push({
        id: `${baseId}#${idx}`,
        source,
        path: absPath,
        priority,
        section: sec.title,
        text: sec.text,
      });
    });
  }
  return sections.length;
}

/**
 * Recolecta el corpus del proyecto de forma dinámica.
 *
 * El `path` apunta al doc original para `memory:file-read` on-demand.
 */
function collectCorpus() {
  const corpus = [];
  const stats = { documents: [], skills: [] };

  // ──────────────────────────────────────────────────────────────────
  // CAPA 1 · DOCS (docs/**/*.md)
  // ──────────────────────────────────────────────────────────────────
  const docFiles = walk(DOCS_DIR, (name) => name.toLowerCase().endsWith(".md"));
  docFiles.sort();
  for (const absPath of docFiles) {
    const id = relId(absPath);
    const chunks = pushDoc(corpus, absPath, "docs", id);
    if (chunks > 0) stats.documents.push({ id, chunks });
  }

  // ──────────────────────────────────────────────────────────────────
  // CAPA 2 · SKILLS (.agents/skills/*/SKILL.md)
  // ──────────────────────────────────────────────────────────────────
  if (existsSync(SKILLS_DIR)) {
    for (const skillName of readdirSync(SKILLS_DIR)) {
      const originalPath = join(SKILLS_DIR, skillName, "SKILL.md");
      if (!existsSync(originalPath)) continue;
      const id = `skills/${skillName}`;
      const chunks = pushDoc(corpus, originalPath, "skills", id);
      if (chunks > 0) stats.skills.push({ id: skillName, chunks });
    }
  }

  return { corpus, stats };
}

async function main() {
  console.log("📂 Recolectando corpus del proyecto...");
  const { corpus, stats } = collectCorpus();

  const totalDocs = stats.documents.length;
  const totalSkills = stats.skills.length;
  console.log(
    `   ${totalDocs} documentos, ${totalSkills} skills → ${corpus.length} chunks (uno por sección ## )\n`,
  );

  const docLabel = (id) => id.replace(/^docs\//, "").padEnd(40, " ");
  const skillLabel = (id) => id.padEnd(40, " ");

  console.log("   Documentos:");
  for (const d of stats.documents) {
    console.log(
      `     📄 ${docLabel(d.id)} ${String(d.chunks).padStart(3)} chunks`,
    );
  }
  console.log("");
  console.log("   Skills:");
  for (const s of stats.skills) {
    console.log(
      `     🔧 ${skillLabel(s.id)} ${String(s.chunks).padStart(3)} chunks`,
    );
  }

  if (corpus.length === 0) {
    console.log(
      "\n⚠️  No hay documentos que vectorizar. Añade `.md` en docs/ o skills en .agents/skills/. Abortando.",
    );
    process.exit(1);
  }

  console.log(
    "\n🧠 Cargando modelo de embeddings (primera vez tarda ~30-60s)...",
  );
  const t0 = Date.now();

  const texts = corpus.map((doc) => truncate(doc.text));
  const embeddings = await embedBatch(texts);
  const dim = embeddings[0].length;
  console.log(`   Dimensión de embeddings: ${dim}`);
  console.log(
    `   Tiempo de embedding: ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  console.log("\n🔍 Generando hiperplanos LSH y hasheando...");
  const lsh = createLSH(dim, { seed: SEED });
  const indexed = corpus.map((doc, i) => ({
    id: doc.id,
    source: doc.source,
    path: doc.path,
    priority: doc.priority ?? null,
    section: doc.section,
    bucket: lsh.hash(embeddings[i]),
    embedding: Array.from(embeddings[i]),
  }));

  const buckets = {};
  for (const item of indexed) {
    buckets[item.bucket] = (buckets[item.bucket] || 0) + 1;
  }
  const totalBuckets = Object.keys(buckets).length;
  const avgPerBucket = (indexed.length / totalBuckets).toFixed(2);
  console.log(
    `   ${totalBuckets} cubetas con avg ${avgPerBucket} chunks/cubeta`,
  );

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const output = {
    meta: {
      version: 2,
      createdAt: new Date().toISOString(),
      model: "Xenova/bge-m3",
      modelFramework: "@xenova/transformers",
      dimension: dim,
      numBits: lsh.numBits,
      seed: SEED,
      totalChunks: indexed.length,
      totalBuckets,
      chunkingStrategy: "## sections",
    },
    documents: indexed,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Índice guardado en ${OUTPUT_FILE}`);
  console.log(
    `   Tamaño: ${(JSON.stringify(output).length / 1024).toFixed(1)} KB`,
  );
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
