/**
 * lsh.mjs
 * ------------------------------------------------------------
 * Locality-Sensitive Hashing (LSH) con random hyperplanes.
 *
 * Idea: si dos vectores son similares, su producto punto con un
 * vector aleatorio tiene大概率 el mismo signo. Usamos N planos
 * (bits) y el hash es la firma de N bits.
 *
 * Vectores similares -> misma firma (con alta probabilidad).
 * Búsqueda O(1) por cubeta.
 *
 * NOTA: el sistema es "semilla-dependiente". Usa siempre la misma
 * semilla para que los hashes sean reproducibles entre procesos.
 * ------------------------------------------------------------
 */

import { createHash } from "node:crypto";

const DEFAULT_SEED = "seed-net-vector-cache-v1";
const DEFAULT_NUM_BITS = 64; // 64 bits = 2^64 cubetas. Suficiente para ~10K docs.

/**
 * Genera un set de N hiperplanos aleatorios reproducibles.
 * @param {number} dim
 * @param {number} numBits
 * @param {string} seed
 * @returns {Float32Array[]} array de numBits vectores de dimensión dim
 */
function generateHyperplanes(dim, numBits, seed) {
  // Usamos un PRNG simple basado en el seed (no criptográfico, pero reproducible).
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  function rand() {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) / 0xffffffff) * 2 - 1; // en [-1, 1]
  }
  const planes = [];
  for (let i = 0; i < numBits; i++) {
    const plane = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      // Aproximación gaussiana via suma de uniformes (Box-Muller simplificado)
      plane[j] = rand() + rand() + rand();
    }
    // Normalizamos (no es necesario matemáticamente, pero ayuda a estabilidad)
    let norm = 0;
    for (let j = 0; j < dim; j++) norm += plane[j] * plane[j];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let j = 0; j < dim; j++) plane[j] /= norm;
    }
    planes.push(plane);
  }
  return planes;
}

/**
 * Hashea un vector a una firma de N bits.
 * @param {Float32Array} vector
 * @param {Float32Array[]} hyperplanes
 * @returns {string} firma en hexadecimal
 */
export function hashVector(vector, hyperplanes) {
  let bits = "";
  for (let i = 0; i < hyperplanes.length; i++) {
    let dot = 0;
    const plane = hyperplanes[i];
    for (let j = 0; j < vector.length; j++) {
      dot += vector[j] * plane[j];
    }
    bits += dot >= 0 ? "1" : "0";
  }
  return createHash("sha1").update(bits).digest("hex").substring(0, 16);
}

/**
 * Crea un indexador LSH con un set de hiperplanos cacheado.
 * @param {number} dim dimensión de los vectores
 * @param {object} opts { numBits, seed }
 */
export function createLSH(dim, opts = {}) {
  const numBits = opts.numBits ?? DEFAULT_NUM_BITS;
  const seed = opts.seed ?? DEFAULT_SEED;
  const hyperplanes = generateHyperplanes(dim, numBits, seed);

  return {
    dim,
    numBits,
    hyperplanes,
    hash: (vector) => hashVector(vector, hyperplanes),
  };
}
