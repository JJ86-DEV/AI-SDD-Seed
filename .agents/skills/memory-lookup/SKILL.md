---
name: memory-lookup
description: Use `memory:lookup` (semantic search over the project's vectorized corpus at `vectorized/corpus.json`, indexed automatically from `documents/`, `skills/`, READMEs, etc.) for any non-code question about project documentation, conventions, rules, architecture docs, workflows, or know-how encoded in markdown. Triggers when the user asks "how does the project handle X", "what's the convention for Y", "where is the rule about Z", or needs to find which document/chunk covers a topic. Returns ranked chunks (id, source, path, section, score); the corpus is the single source of truth.
---

# memory:lookup

`memory:lookup` is the project's **semantic search** over a pre-vectorized corpus of project documentation. The corpus lives at `vectorized/corpus.json` and is re-indexed automatically — it does not require manual maintenance.

This skill documents how to use `memory:lookup` in isolation: command, parameters, score interpretation, and its scope. It does not depend on other tooling.

---

## Comando

```bash
rtk pnpm run memory:lookup "<query>"
```

The `rtk` prefix is safe: if there is no dedicated filter, it passes through unchanged.

### Parámetros

| Flag | Default | Efecto |
|---|---|---|
| `--top N` | `3` | Número máximo de chunks devueltos |
| `--threshold 0.N` | `0.5` | Score mínimo para incluir un chunk en los resultados |
| `--human` | `false` | Formato legible (lista con porcentaje y path) en vez de JSON |

Sin flags adicionales: una sola query posicional.

### Salida

JSON a stdout con la forma:

```json
{
  "query": "tu query",
  "results": [
    {
      "id": "docs/stack.md#3",
      "source": "docs",
      "path": "<RUTA_PROYECTO>/docs/stack.md",
      "section": "Persistencia",
      "score": 0.663
    }
  ]
}
```

A stderr se imprime una línea de métricas (no contamina el JSON parseable):

```text
[lookup] query="..." hits=X/Y topScore=0.NNN threshold=0.5
```

### Multiplicador de prioridad

Los chunks con `priority: "high"` en el corpus se **multiplican por 1.5** antes de ordenar. Esto hace que la documentación marcada como crítica (convenciones, protocolos, hard rules) suba en el ranking aunque su embedding no sea el más cercano literalmente.

---

## Cuándo usarlo

| Caso | Ejemplo de query |
|---|---|
| Encontrar la regla / convención sobre X | `"convención nombres composables"` |
| Saber cómo el proyecto maneja Y | `"manejo de errores en API"` |
| Localizar el documento que cubre Z | `"protocolo code review"` |
| Hallar know-how operativo | `"formato fechas i18n"` |
| Entender un workflow documentado | `"flujo de firma digital"` |
| Duda sobre el stack | `"state management pinia"` |

La regla general: si la respuesta esperada está en un `.md`, `.json` de docs, o en un skill, `memory:lookup` la encuentra.

---

## Cuándo NO usarlo

| Caso | Razón |
|---|---|
| Código fuente (`.cs`) | El corpus indexa docs, no código. Para símbolos usa el proveedor de code-graph (`codebase-memory-mcp` por defecto) |
| Texto literal exacto | Embedding ≠ grep. Para matches literales usa búsqueda por texto |
| Path conocido del fichero | Salta el lookup y lee el archivo directamente |
| Ficheros fuera de `documents/`, `skills/`, READMEs | El corpus no los cubre; no están indexados |
| Assets binarios (imágenes, fonts, certificados) | No aplica |

Si `memory:lookup` devuelve lista vacía o score < 0.5, **no** significa "no existe la regla" — significa que el corpus no tiene un chunk con suficiente similitud. Antes de concluir nada, prueba reformulaciones o baja el `--threshold`.

---

## Interpretación de scores

| Rango | Significado | Acción |
|---|---|---|
| `> 0.8` | Match claro | `--top 1`, lee solo la sección indicada |
| `0.5 - 0.8` | Match tibio / varios candidatos | `--top 3`, mira scores y elige |
| `< 0.5` | Ruido / corpus no contiene el tema | Reformula o baja `--threshold` con cuidado |

> **Nunca** bajes `--threshold` por inercia. Si el corpus no tiene el tema, bajar el threshold solo añade más ruido.

---

## Patrones de uso

### Búsqueda dirigida por título

Cuando conoces el título exacto de la sección que buscas, usa el título literal como query. El corpus indexa por sección y el embedding captura el título con precisión.

```bash
rtk pnpm run memory:lookup "PASO 3 VALIDACIÓN PRE-EDICIÓN"
```

Resultado esperado: score alto (>0.8), un solo chunk relevante.

### Búsqueda por concepto

Cuando no conoces el título, usa palabras clave del concepto.

```bash
rtk pnpm run memory:lookup "convenciones naming XML docs C#"
```

Resultado esperado: 2-3 chunks candidatos, scores 0.5-0.7. Lee los `path` y decide.

### RRF manual (fusión de rankings)

Cuando una sola query da score tibio o resultados ruidosos, lanza **2-3 queries con palabras distintas** (sinónimos, reformulaciones) y combina los rankings mentalmente. Un chunk que aparece en varios resultados pesa más. Es Reciprocal Rank Fusion hecho a mano.

```bash
rtk pnpm run memory:lookup "anti-patterns refactor"
rtk pnpm run memory:lookup "prohibiciones documentadas"
rtk pnpm run memory:lookup "qué NO hacer en cambios"
```

Optativo, solo cuando una sola query no dé confianza.

### Inspección humana

Cuando quieras leer resultados como humano (no como máquina):

```bash
rtk pnpm run memory:lookup "stack tecnológico" --human
```

Formato con porcentaje, id, sección y path en líneas separadas.

---

## Antipatterns

### 1. Query compuesta con 5-10 keywords

Encadenar muchas keywords en una sola query diluye el embedding y mete ruido. El corpus indexa por sección; usa el **título de la sección** o **2-3 keywords** máximo.

- ❌ `"convenciones nombres composables vue 3 typescript eslint prettier project rules"`
- ✅ `"convención nombres composables"`

### 2. Iterar la misma query sin reformular

Si una query devuelve score < 0.5, **no** la lances otra vez esperando un resultado distinto. **Reformula** con sinónimos, o cambia el ángulo (de "¿qué es X?" a "regla sobre X").

### 3. Usar `memory:lookup` para código fuente

El corpus no indexa `.cs`. Lanzarlo sobre nombres de clases/métodos devuelve vacío o scores espurios. Para código: el proveedor de code-graph (`codebase-memory-mcp`).

### 4. Bajar `--threshold` por inercia

Bajar el threshold para "ver si aparece algo" introduce chunks sin relación semántica suficiente. El threshold por defecto (`0.5`) está calibrado. Si no hay match, **reformula** la query, no bajes el threshold.

### 5. Asumir "no encontrado" = "no existe"

Score bajo no significa "no existe la regla". Puede significar:
- Corpus no indexado aún (`vectorized/corpus.json` ausente) → ejecutar vectorizado del proyecto
- Query mal formulada → reformular
- Documentación en path no indexado → verificar scope

Antes de concluir "no documentado", valida con otra herramienta o pregunta al usuario.

### 6. Lanzar `memory:lookup` cuando ya tienes el path

Si conoces el path del fichero, saltar el lookup y leer directamente es más rápido y preciso. `memory:lookup` es para **descubrir**; no para **reconfirmar**.

---

## Verificación del corpus

```bash
# ¿Existe el corpus?
ls -la vectorized/corpus.json

# ¿Está sano? (tamaño esperado > 1 MB para un proyecto con docs/skills)
rtk wc -c vectorized/corpus.json

# Si falta: regenerar
rtk pnpm run vectorize:project
```

Si `memory:lookup` falla con `❌ No existe .../vectorized/corpus.json`, el corpus no está indexado. Generarlo antes de continuar.

---

## Resumen ejecutivo

1. `memory:lookup` es búsqueda **semántica** sobre `vectorized/corpus.json`. NO es grep ni regex.
2. Query = título de sección (literal) o 2-3 keywords del concepto. Nada más.
3. `--top 1` cuando hay match claro (>0.8); `--top 3` cuando es tibio (0.5-0.8).
4. Score < 0.5 → reformular, no bajar threshold por inercia.
5. No indexa código fuente. No sustituye CodeGraph.
6. Si el corpus no existe, regenerar antes de consultar.