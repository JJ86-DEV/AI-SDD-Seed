# Sistema de memoria del proyecto (vectorización + caché semántica)

Este backend .NET incluye un sistema de **memoria para agentes de IA** (Copilot en
Visual Studio 2026 —prioritario— y VS Code): un corpus de documentación y skills
embebido con un modelo local, búsqueda semántica, una caché de prompts y un lector
de ficheros cacheado. Da a los agentes contexto del proyecto sin re-explorar en cada
sesión.

> Gestor de paquetes: **pnpm**. Todos los comandos se prefijan con `rtk` (proxy de
> tokens, passthrough seguro).

---

## 1. Puesta en marcha (una vez)

```bash
pnpm install                 # instala @xenova/transformers (bge-m3). Autoriza builds de sharp/protobufjs (ya en pnpm-workspace.yaml)
pnpm run vectorize:project   # genera vectorized/corpus.json. 1ª vez descarga bge-m3 (~570MB) a ~/.cache/huggingface
```

El proveedor de navegación de código (`codebase-memory-mcp`) ya viene indexado. Si no
responde, ejecuta `index_repository` desde el MCP.

---

## 2. Arquitectura de ficheros

```
docs/                         # CORPUS (fuente): docs .md del proyecto, chunkificados por "## "
.agents/skills/<n>/SKILL.md    # CORPUS (fuente): skills, se indexan solas (glob dinámico)
.agents/config.json            # toggle del proveedor de code-graph
.github/agents/*.agent.md      # el agente principal + los 3 gates (formato Copilot VS)
scripts/vectorize/             # index.mjs (build corpus), embedder, lsh, test-query
scripts/memory/                # lookup, file-read, semantic-cache
vectorized/                    # GENERADO (en .gitignore): corpus.json, file-cache.json, semantic-cache.json
```

### Quién genera qué (importante)

| Fichero | Lo genera | Cuándo |
|---|---|---|
| `vectorized/corpus.json` | `scripts/vectorize/index.mjs` (`vectorize:project`) | Build **deliberado**: cuando tú lanzas la vectorización. Es el único que regeneras a mano. |
| `vectorized/file-cache.json` | `scripts/memory/file-read.mjs` | **Lazy**: en el primer MISS de cada `memory:file-read <path>`. Se auto-puebla con el uso (guarda `mtime+size+sha+content`). |
| `vectorized/semantic-cache.json` | `scripts/memory/semantic-cache.mjs` | **Lazy**: cuando algo hace `put`. En el flujo normal es el writeback final del agente; también si tú haces `put`/`clear`. |

El corpus es un build; los dos caches nacen solos al usarse.

---

## 3. Las herramientas

### `memory:lookup` — búsqueda **semántica** en el corpus (docs/skills, NO código)

```bash
rtk pnpm run memory:lookup "regla de dependencias Clean Architecture"
rtk pnpm run memory:lookup "PASO 3 VALIDACIÓN PRE-EDICIÓN" -- --top 1 --human
```

| Flag | Default | Efecto |
|---|---|---|
| `--top N` | 3 | nº máximo de chunks |
| `--threshold 0.N` | 0.5 | score mínimo |
| `--human` | off | salida legible en vez de JSON |

- Query = **título literal de sección** o **2-3 keywords**. No 5-10 (diluye el embedding).
- Score >0.8 → `--top 1`. 0.5-0.8 → `--top 3` y eliges. <0.5 → **reformula** (no bajes el threshold por inercia).
- Los docs con `priority: high` (frontmatter) puntúan ×1.5.

### `memory:file-read` — lectura por path con **caché persistente**

```bash
rtk pnpm run memory:file-read docs/stack.md
rtk pnpm run memory:file-read --cache-stats
rtk pnpm run memory:file-read --clear-cache
```

HIT (mtime+size coinciden) → 0 I/O. MISS → lee, cachea y devuelve. Detecta cambios solo.
Para ficheros del proyecto por path conocido (docs, configs, `.csproj`, `appsettings.json`).
No para binarios ni para descubrir paths.

### `memory:semantic-cache` — caché de prompts+respuestas

```bash
rtk pnpm run memory:semantic-cache -- put --prompt "..." --value '{"...":"..."}'
rtk pnpm run memory:semantic-cache -- get --prompt "..." --top 3 --threshold 0.88
rtk pnpm run memory:semantic-cache -- stats
rtk pnpm run memory:semantic-cache -- clear
```

Embed + LSH + cosine. Purga TTL (24h por defecto) automáticamente en `get`/`stats`.
No guardes secretos en `--value`/`--metadata`.

### `vectorize:project` / `vectorize:test`

```bash
rtk pnpm run vectorize:project                        # (re)genera el corpus
rtk pnpm run vectorize:test -- "dónde van los DTOs"   # sanity check
```

---

## 4. Proveedor de code-graph (para código `.cs`)

Para navegar código fuente (`.cs`) **no** se usa `memory:lookup` (eso es para docs):
se usa el proveedor de code-graph, seleccionado en `.agents/config.json`
(`"codeGraphProvider"`). Por defecto `codebase-memory-mcp`; fallback `codegraph`.

Regla de oro: **código `.cs` → code-graph** · **docs/reglas → `memory:lookup`** ·
**fichero por path → `memory:file-read`**.

### 4.1. `codebase-memory-mcp` (proveedor por defecto)

Grafo de conocimiento del código, servido por un servidor MCP que expone tools
(`search_graph`, `get_code_snippet`, `trace_path` [`mode=calls|data_flow|cross_service`],
`get_architecture`, `query_graph`, `search_code`, `index_status`, `index_repository`…).
Ver la skill `codebase-memory-mcp` para el mapa función→tool.

- **Origen:** https://github.com/DeusData/codebase-memory-mcp (MIT).
- **Requisitos:** compilador C y C++, zlib, Git.

**a) Instalar la herramienta**

Al instalar se **descarga y coloca el binario** en el sistema (lo añade al PATH) y se
autoconfiguran los agentes detectados.

Windows (PowerShell):

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1
Unblock-File .\install.ps1
.\install.ps1
# Si hay error de execution policy: Set-ExecutionPolicy -Scope Process Bypass  (antes del install)
```

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```

O vía gestor de paquetes: `npm install -g codebase-memory-mcp` · `pip install codebase-memory-mcp`
· `brew install codebase-memory-mcp` · Scoop / Winget / Chocolatey. También hay binarios en
[releases](https://github.com/DeusData/codebase-memory-mcp/releases/latest).

Ciclo de vida:

```bash
codebase-memory-mcp --version      # comprobar versión (repo: 0.9.0; en esta máquina: 0.8.1 → conviene update)
codebase-memory-mcp update         # actualizar
codebase-memory-mcp uninstall      # desinstalar (quita config de agentes, skills, hooks y binario)
```

> Verifica el PATH tras instalar: `which codebase-memory-mcp` (o `Get-Command codebase-memory-mcp`).

**b) Registrar el `.mcp` en tu editor/agente**

El instalador **auto-detecta y configura** los agentes (Claude Code → `~/.claude.json`,
Cursor → `.cursor/mcp.json`, VS Code → `Code/User/mcp.json`, y 40+ más). Tras instalar,
**reinicia el agente**. Si necesitas re-registrar sin reinstalar el binario:

```bash
codebase-memory-mcp install        # (re)configura los agentes detectados
```

Registro **manual** (Claude Code / `.mcp.json` de proyecto) — servidor por stdio,
`command` = ruta del binario:

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "codebase-memory-mcp",
      "args": []
    }
  }
}
```

> **VS 2026:** si tu instalación no lo autoconfigura (verifícalo con `/mcp` o el panel de
> MCP del editor), añade la misma entrada en su configuración MCP apuntando al binario.
> Luego habilita el servidor para el agente **Architecture Memory**.

**c) Indexar el proyecto por primera vez (vía terminal)**

El indexado suele ser **automático** (`auto_index = true`; en el agente basta con decir
"indexa este proyecto"), pero puedes forzarlo por CLI:

```bash
# repo_path debe ser ABSOLUTA
codebase-memory-mcp cli index_repository '{"repo_path":"<RUTA_PROYECTO>"}'

# comprobar estado / proyectos
codebase-memory-mcp cli list_projects
codebase-memory-mcp cli index_status '{"project":"<NOMBRE_PROYECTO_INDEXADO>"}'
```

`codebase-memory-mcp cli <tool> '<json>'` ejecuta cualquier tool MCP desde terminal
(scripts/verificación). Sin argumentos, el binario arranca el servidor MCP por stdio (lo
que consume el editor). Resolución semántica LSP para C#, entre otros.

**d) Configuración**

```bash
codebase-memory-mcp config list
codebase-memory-mcp config set auto_index false      # desactivar auto-index en session start
codebase-memory-mcp config set auto_watch false      # desactivar el watcher git de auto-sync
codebase-memory-mcp config reset auto_index          # volver al default
```

| Clave | Default | Efecto |
|---|---|---|
| `auto_index` | `true` | indexa al iniciar sesión |
| `auto_index_limit` | `50000` | límite de ficheros para auto-index |
| `auto_watch` | `true` | detección de cambios basada en git (auto-sync) |

Variables de entorno útiles: `CBM_CACHE_DIR` (BD del grafo, default `~/.cache/codebase-memory-mcp`),
`CBM_LOG_LEVEL`, `CBM_WORKERS`, `CBM_DIAGNOSTICS`. UI opcional del grafo: instala con `--ui`
(o `codebase-memory-mcp --ui=true --port=9749`).

### 4.2. `codegraph` (proveedor fallback)

Si prefieres no usar `codebase-memory-mcp`, cambia en `.agents/config.json`:

```json
{ "codeGraphProvider": "codegraph" }
```

Es una CLI que se ejecuta con `pnpm dlx` (no requiere instalación permanente). Ver la
skill `codegraph-architecture-agent`. Comandos:

```bash
pnpm dlx @colbymchenry/codegraph status              # estado del índice
pnpm dlx @colbymchenry/codegraph init                # indexar (1ª vez / si stale)
pnpm dlx @colbymchenry/codegraph search "UsersRepository"
pnpm dlx @colbymchenry/codegraph callers "GetByIdAsync"   # quién llama
pnpm dlx @colbymchenry/codegraph impact  "GetByIdAsync"   # blast radius
```

Equivalencias con el proveedor por defecto: `search` ≈ `search_graph`,
`node` ≈ `get_code_snippet`, `callers`/`callees` ≈ `trace_path mode=calls`,
`impact` ≈ análisis de impacto. No re-indexes con `init` salvo que `status` lo pida.

---

## 5. El agente (Architecture Memory)

En VS 2026 / VS Code seleccionas el agente **Architecture Memory** y le hablas normal.
Su flujo interno:

1. **cache-gate** — ¿hay un prompt parecido ya resuelto en caché? Si cubre todo → *fast path*.
2. **Modo 1** exploración ligera (proveedor de code-graph + skills) → **Modo 2** PLAN.
3. **request-gate** (¿ambigüedad?) → **compliance-gate** (¿herramientas/orden/scope óptimos?).
   En serie y **obligatorios** antes de mutar código.
4. **Modo 4** ejecución: *fast path* para cambios de 1-3 líneas; protocolo arquitectónico
   (7 secciones) para decisiones de diseño.
5. **Writeback** del resultado a la caché semántica.

En la práctica:
- Pregunta o cambio quirúrgico ("¿de dónde sale este campo?", "cambia X por Y") → va directo.
- Tarea grande ("evaluamos migrar…", "nuevo servicio") → modo arquitectónico.
- Si escribes **"para" / "stop"** → el siguiente turno es cero acciones.

Los 3 gates (`cache-gate`, `request-gate`, `compliance-gate`) son subagentes en
`.github/agents/` que el agente invoca con `runSubagent` (modelo `Rator Mini`).

---

## 6. Mantener el corpus vivo

El agente solo "sabe" lo que está vectorizado. Cuando cambie el conocimiento del proyecto:

- **Doc nuevo/editado** → crea/edita `docs/*.md` (usa `## secciones`; `priority: high` en
  frontmatter para reglas críticas) y **re-vectoriza**: `rtk pnpm run vectorize:project`.
- **Skill nueva** → `.agents/skills/<nombre>/SKILL.md` y re-vectoriza (se indexa sola).
- **Decisión de arquitectura** → anótala en `docs/diario-arquitectura.md`.

`docs/architecture-compliance-protocol.md` alimenta la "boot table" del agente (secciones
`Principios Vinculantes`, `Comportamientos Prohibidos/Obligatorios`, `PASO 1..10`,
`Dirección de dependencias / layering`, `Ubicación de DTOs/Contracts y pureza del Domain`).
Si renombras esos títulos, actualiza también `.github/agents/archiecture-memory.agent.md`.

---

## 7. Notas de entorno

- pnpm bloquea build scripts por defecto; `sharp` (nativo, lo carga transformers.js) y
  `protobufjs` están autorizados en `pnpm-workspace.yaml` (`allowBuilds`). Si `pnpm install`
  te pregunta por ellos, ya están permitidos.
- El modelo de embeddings (`Xenova/bge-m3`, 1024d) se descarga una vez y se cachea en
  `~/.cache/huggingface`. Cold start ~30-60s la primera query de una sesión.
