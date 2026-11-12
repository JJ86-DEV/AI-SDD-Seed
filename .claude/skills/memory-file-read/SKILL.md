---
name: memory-file-read
description:
  Use `memory:file-read` (a persistent on-disk read cache at `vectorized/file-cache.json` keyed by absolute path + mtime + size) for any read of a project file by known path: docs, READMEs, configs (`package.json`, `tsconfig*.json`, `vite.config.ts`, etc.), skills, or any file where you already know the path. Returns the file content with `fromCache: true|false`. Triggers when the user says "read file X", "show me config Y", "what's in Z", or whenever you need the content of a specific file in this project. The cache is shared across sessions, tools, and sub-agents; re-reads of unchanged files cost ~0.
---

# memory:file-read

`memory:file-read` is a **cached file reader**: it returns the content of a file from the project, with a persistent on-disk cache that survives sessions, tools, and sub-agents.

The cache lives at `vectorized/file-cache.json` and is keyed by absolute path. Each entry stores `{ mtime, size, sha, ts, content }`. On every call, the script does `stat()`, compares `mtime` and `size` with the cache, and either:

- **Hit** (`mtime + size` match) → returns cached content without reading the file.
- **Miss** (mtime or size differ, or no entry) → reads from disk, computes SHA256, updates cache, returns content.

This skill documents how to use `memory:file-read` in isolation: command, flags, output shape, and its scope. It does not depend on other tooling.

---

## Comando

```bash
rtk pnpm run memory:file-read <path>
```

Path can be relative (resolved against the project root) or absolute.

### Flags

| Flag | Efecto |
|---|---|
| `--cache-stats` | Muestra `entries`, `fileSizeKb` y `path` del cache. Sin leer ningún fichero. |
| `--clear-cache` | Vacía el cache (escribe `{}`). Útil tras regenerar docs masivamente. |

No acepta otros flags. No hay `--top`, `--threshold`, `--human` — esto no es búsqueda, es lectura directa.

### Salida

JSON a stdout con la forma:

```json
{
  "path": "<RUTA_PROYECTO>/.../file.md",
  "sha": "ab12...",
  "mtime": 1782117998632.69,
  "size": 33168,
  "fromCache": false,
  "content": "...contenido completo del fichero..."
}
```

A stderr se imprime la métrica de la operación:

```text
[file-read] MISS path=... size=33168 (read 32390 chars from disk, cached)
[file-read] HIT  path=... size=33168 (served from cache, no disk read)
```

El flag `fromCache` indica si el contenido vino del cache (`true`) o se leyó del disco en esta llamada (`false`).

---

## Cuándo usarlo

| Caso | Ejemplo |
|---|---|
| Leer un documento del proyecto cuando ya sabes el path | `rtk pnpm run memory:file-read docs/stack.md` |
| Leer un config (`appsettings.json`, `package.json`, `*.csproj`, etc.) | `rtk pnpm run memory:file-read src/Api/appsettings.json` |
| Leer el contenido de un skill antes de aplicarlo | `rtk pnpm run memory:file-read .agents/skills/ef-core/SKILL.md` |
| Releer un fichero ya visto en la sesión (cache hit) | segunda llamada al mismo path |
| Releer tras cambios en otras sesiones (cache detecta mtime+size) | automático, sin flags |
| Inspeccionar el estado del cache | `--cache-stats` |
| Regenerar el cache tras un cambio masivo | `--clear-cache` |

**Regla general**: si conoces el path del fichero que necesitas, `memory:file-read` es la opción. Si no conoces el path y necesitas descubrirlo, busca primero con otra herramienta.

---

## Cuándo NO usarlo

| Caso | Razón |
|---|---|
| Ficheros binarios (imágenes, PDFs, fuentes, certificados) | El script lee como `utf8`. Binarios se corrompen |
| Directorios | El script falla con error explícito |
| Path vacío | `process.exit(1)` con mensaje de uso |
| Path que no existe | `process.exit(1)` con el path absoluto calculado |
| Descubrir un path desconocido | No es búsqueda. Para descubrir, usa lookup u otra herramienta primero |
| Streams o pipes | Es lectura completa a memoria. Ficheros enormes cargan todo en JSON |

---

## Cómo funciona la caché

### Hit (camino rápido)

```text
1. stat(path) → { mtime, size }
2. cache[path].mtime === mtime && cache[path].size === size
3. Si sí → devuelve cache[path].content con fromCache: true
4. NO se lee el disco
```

### Miss (camino lento)

```text
1. stat(path) → { mtime, size }
2. cache[path] no existe o mtime/size no coinciden
3. readFileSync(path, "utf8")
4. sha256(content)
5. cache[path] = { mtime, size, sha, ts: Date.now(), content }
6. saveCache(cache)
7. Devuelve content con fromCache: false
```

### Garantías

- **Detección de cambios**: `mtime` + `size` cubren el 100% de modificaciones a nivel de filesystem. Si el archivo cambió, la cache se invalida sola.
- **Persistencia**: la cache sobrevive entre sesiones, herramientas y sub-agentes. El primer HIT en una sesión nueva es tan rápido como el último de la anterior.
- **SHA256 por archivo**: permite detectar cambios incluso si dos archivos tuvieran el mismo `mtime` y `size` (poco probable, pero robusto).
- **Sin invalidación manual por cambio legítimo**: edita un archivo, la siguiente lectura detecta el cambio por mtime+size y actualiza la cache. No necesitas `--clear-cache` salvo tras regeneraciones masivas (p. ej. regenerar todos los docs del corpus).

---

## Patrones de uso

### Lectura con verificación de cache

```bash
rtk pnpm run memory:file-read docs/stack.md
```

Observa la línea stderr: `[file-read] HIT` significa "no gasté I/O"; `MISS` significa "leí del disco y cacheé para la próxima".

### Releer tras edit

Después de un `replace_string_in_file`, releer el path con `memory:file-read` muestra el contenido actualizado. La cache detecta el cambio por `mtime` y devuelve `fromCache: false` con el contenido nuevo.

### Inspección del estado del cache

```bash
rtk pnpm run memory:file-read --cache-stats
```

Salida:

```json
{
  "entries": 47,
  "fileSizeKb": "312.4",
  "path": "<RUTA_PROYECTO>/vectorized/file-cache.json"
}
```

Útil cuando sospechas que el cache está obsoleto o demasiado grande.

### Vaciar el cache

```bash
rtk pnpm run memory:file-read --clear-cache
```

Vacía `vectorized/file-cache.json`. La siguiente lectura de cualquier path será MISS y empezará a re-poblar la cache.

---

## Antipatterns

### 1. Releer con `fromCache: true` y asumir cambio

`fromCache: true` significa "el archivo no cambió desde la última lectura". Si esperas un cambio y la respuesta es `fromCache: true`, **el archivo no cambió** (o tu edición no persistió). Releer no aporta información nueva.

### 2. Pasar path de directorio

El script falla con exit 1. Si necesitas listar un directorio, usa otra herramienta (`ls`).

### 3. Pasar path binario

El script lee como `utf8`. Imágenes, PDFs, fuentes y similares salen corruptos. Para binarios, otra herramienta.

### 4. Vaciar el cache por inercia

`--clear-cache` es destructivo en términos de rendimiento: las próximas lecturas de todo el cache serán MISS. Úsalo solo cuando:
- Has regenerado masivamente los docs y el cache tiene entradas obsoletas masivamente.
- `cache-stats` muestra que el cache ha crecido de forma anómala.
- Sospechas de corrupción en el JSON del cache.

No lo uses "por si acaso".

### 5. Usarlo para descubrir paths

`memory:file-read` necesita el path. Si no lo tienes, primero localiza con lookup, grep, o listado de directorios. Pasar un path incorrecto falla con exit 1.

### 6. Asumir que HIT = archivo idéntico bit-a-bit

El chequeo es `mtime + size`. Dos editores distintos que escriben el mismo contenido con timestamps distintos provocarán MISS aunque el contenido sea idéntico. El SHA256 se calcula y almacena, pero la decisión HIT/MISS se hace por `mtime + size`. Esto es robusto en la práctica, pero conviene saberlo.

---

## Verificación

```bash
# Estado del cache (sin leer ningún fichero)
rtk pnpm run memory:file-read --cache-stats

# Vaciar si está corrupto o desfasado
rtk pnpm run memory:file-read --clear-cache

# Lectura real (la más simple)
rtk pnpm run memory:file-read <path>
```

Si `memory:file-read` falla con exit 1, lee el stderr:
- `❌ No existe: <path>` → path incorrecto o archivo borrado.
- `❌ Es un directorio, no un fichero: <path>` → pasaste un directorio.
- `Uso: pnpm run memory:file-read <path> ...` → path vacío o flag incorrecto.

---

## Resumen ejecutivo

1. `memory:file-read` lee un fichero del proyecto con **cache persistente** cross-session.
2. HIT cuando `mtime + size` coinciden; MISS en caso contrario. Cache transparente.
3. Path relativo se resuelve contra el ROOT del proyecto; absoluto se usa tal cual.
4. Salida JSON con `path`, `sha`, `mtime`, `size`, `fromCache`, `content`.
5. `--cache-stats` y `--clear-cache` para admin. Nada más.
6. No para binarios, directorios, ni para descubrir paths.