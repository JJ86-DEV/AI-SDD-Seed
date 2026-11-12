/**
 * embedder.mjs
 * ------------------------------------------------------------
 * Wrapper de @xenova/transformers (transformers.js) con
 * Xenova/bge-m3 como modelo de embeddings.
 *
 * Por qué bge-m3 y no paraphrase-multilingual-MiniLM-L12-v2:
 *  - 8192 tokens de ventana (vs 128 de MiniLM-L12) — no trunca
 *    docs largos del corpus (arquitectura, diario, etc.).
 *  - 1024d (vs 384d de MiniLM-L12) — más expresividad semántica.
 *  - Multilingüe fuerte (100+ idiomas, incluye español técnico).
 *  - Trade-off: más lento y pesado que MiniLM-L12. Cold start
 *    ~30-60s la primera vez; después ~200-500ms por query.
 *  - Modelo: ~570MB
 *
 * NOTA: la primera invocación descarga el modelo desde HuggingFace
 * y lo cachea en ~/.cache/huggingface/ para las siguientes.
 * ------------------------------------------------------------
 */

import { pipeline, env } from "@xenova/transformers";

// Permitimos modelos remotos y cache local
env.allowLocalModels = false;
env.useFsCache = true;

const MODEL_NAME = "Xenova/bge-m3";

let pipelinePromise = null;

/**
 * Carga el pipeline de feature-extraction (singleton). Lazy.
 * @returns {Promise<Function>}
 */
export function getModel() {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", MODEL_NAME, {
      // Cuantización opcional para ahorrar RAM (ligera pérdida de calidad)
      // quantized: true,
    });
  }
  return pipelinePromise;
}

/**
 * Embebe un texto a un vector de 1024 dimensiones.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
export async function embed(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embed() requiere un string no vacío");
  }
  const extractor = await getModel();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output.data es Float32Array de tamaño 1024
  return new Float32Array(output.data);
}

/**
 * Embebe un batch de textos.
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("embedBatch() requiere array no vacío");
  }
  const extractor = await getModel();
  const results = [];
  // Procesamos en serie para no saturar memoria con batches grandes.
  // En el corpus del proyecto (~16 docs) es despreciable.
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    results.push(new Float32Array(output.data));
  }
  return results;
}

/**
 * Cálculo de similitud coseno entre dos vectores.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} en [-1, 1]
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(
      `vectores de distinta dimensión: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
