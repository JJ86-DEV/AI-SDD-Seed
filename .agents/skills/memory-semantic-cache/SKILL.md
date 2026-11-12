---
name: memory-semantic-cache
description: Use `memory:semantic-cache` whenever the user wants to cache user prompts semantically (embed + LSH + disk persistence), retrieve similar prompts, manage TTL expiration, inspect cache metrics, or clear semantic cache state. Trigger on requests like "cache semantica", "reutilizar prompts parecidos", "guardar prompt+respuesta", "buscar en cache por similitud", "TTL de prompts", or "limpiar cache".
---

# memory:semantic-cache

`memory:semantic-cache` gestiona una cache semantica de prompts en disco usando embeddings + LSH.

Regla operativa: SIEMPRE ejecutar el script de package con prefijo RTK.

Comando base:

```bash
rtk pnpm run memory:semantic-cache -- <comando> [flags]
```

No usar `pnpm run memory:semantic-cache` sin `rtk`.

## Comandos

### 1) put
Guarda o actualiza una entrada en cache.

```bash
rtk pnpm run memory:semantic-cache -- put \
  --prompt "crear tabla con paginacion" \
  --value '{"template":"table-v1"}'
```

Flags relevantes:
- `--prompt` texto origen a vectorizar
- `--value` payload cacheado (string JSON o texto)
- `--value-file` alternativa para leer payload desde fichero
- `--id` upsert por identificador
- `--metadata` JSON opcional
- `--ttl-ms` TTL en ms (default 86400000 = 24h)

### 2) get
Busca entradas similares por bucket LSH + cosine similarity.

```bash
rtk pnpm run memory:semantic-cache -- get \
  --prompt "necesito una tabla paginada en vue" \
  --top 3 \
  --threshold 0.88
```

Flags relevantes:
- `--top` max resultados
- `--threshold` score minimo
- `--scope auto|bucket|global`

Nota TTL: antes de responder, el comando purga entradas expiradas automaticamente.

### 3) stats
Muestra metadata y metricas de la cache.

```bash
rtk pnpm run memory:semantic-cache -- stats
```

Salida esperada:
- `meta.ttlMs` TTL por defecto (24h)
- `purgedExpired` cantidad eliminada por expiracion
- `stats.totalEntries`, `stats.totalBuckets`

### 4) clear
Resetea completamente el fichero de cache semantica.

```bash
rtk pnpm run memory:semantic-cache -- clear
```

## Convenciones

1. Mantener semilla estable para reproducibilidad de buckets LSH.
2. Para flujos normales, usar `--scope auto`.
3. No guardar secretos en `--value` ni `--metadata`.
4. Si hay misses inesperados, revisar `threshold` y `stats` antes de cambiar semilla.

## Cuando usar esta skill

Usar esta skill cuando el usuario pida cualquiera de estos objetivos:
- cachear prompts y respuestas reutilizables
- deduplicar prompts parecidos
- controlar expiracion (TTL) de cache de prompts
- limpiar o inspeccionar cache semantica

No usar esta skill para leer ficheros por path exacto (usar memory:file-read) ni para buscar reglas de documentacion (usar memory:lookup).
