# AI-SDD Tooling

CLI de preparación y operación del entorno para trabajar con el sistema de
agentes de este repositorio (RTK, CodeGraph, CodeBase memory MCP, skills,
corpus vectorizado, cache de ficheros y cache semántica de prompts).

Ubicación del entrypoint: [`scripts/cli/tooling.mjs`](../scripts/cli/tooling.mjs).

## Cómo lanzarla

```powershell
pnpm run tooling
```

Sin argumentos abre el menú interactivo (banner ASCII + navegación con
flechas, vía `inquirer`). También admite un modo directo apto para CI o
scripts, pasando comando/subcomando tras `--`:

```powershell
pnpm run tooling -- doctor [--deep] [--json]
pnpm run tooling -- setup <rtk|codegraph|codebase-memory|skills|mcp|all> [--yes|--no]
pnpm run tooling -- run <vectorize|install|all|vectorize-test|memory-lookup|memory-file-read|memory-semantic-cache> [--yes|--no]
```

- `--yes`: asume "sí" a todas las confirmaciones y, en los submenús con
  varias opciones, toma siempre la última entrada por convención (que en
  esta CLI es siempre la salida: "← Volver" / "← Cancelar", o en menús de
  acciones sin "volver", la opción menos intrusiva).
- `--no`: asume "no" a todas las confirmaciones.
- Sin `--yes` ni `--no`: modo semi-interactivo, sigue preguntando por
  `inquirer` aunque se haya indicado comando/subcomando por argumentos.

## Estructura interna

| Archivo | Responsabilidad |
|---|---|
| [`scripts/cli/tooling.mjs`](../scripts/cli/tooling.mjs) | Entry point. Banner, menús interactivos (`menuSetup`, `menuRun`), modo directo (`directMode`), helpers de IO (`makeIo`) que desacoplan las acciones de `inquirer`. |
| [`scripts/doctor/checks.mjs`](../scripts/doctor/checks.mjs) | Checks puros de entorno (sin lógica de CLI) + helpers reutilizables (`tryExec`, `tryExecArgs`, `spawnDetached`, `hyperlink`, constantes de URLs/puertos). |
| [`scripts/setup/actions.mjs`](../scripts/setup/actions.mjs) | Acciones de "Setup": RTK, CodeGraph (fallback CLI), CodeBase memory (servidor MCP: instalación, UI, auto-index, indexación), skills (propietarias + `skills-lock.json`), servidores MCP (`.mcp.json`: codegraph / ado / codebase-memory). |
| [`scripts/run/actions.mjs`](../scripts/run/actions.mjs) | Acciones de "Run": indexación del corpus, instalación de dependencias node, query de prueba contra el corpus, búsqueda semántica, lectura de fichero con cache, cache semántica de prompts. |

Todas las acciones de `setup/actions.mjs` y `run/actions.mjs` reciben un
objeto `io` con:

```js
io.log(message)
io.confirm(message, defaultValue) -> Promise<boolean>
io.select(message, choices)       -> Promise<value>
io.input(message, defaultValue)   -> Promise<string>
```

Esto permite que la misma acción funcione en modo interactivo (`inquirer`)
y en modo no interactivo/CI (`--yes`/`--no`), sin acoplar la lógica de
negocio a la librería de prompts.

Cada acción devuelve `{ name, status: "ok"|"warn"|"fail", message, hint? }`.
Si `hint` es una URL, la CLI la imprime como enlace clicable (ver
sección "Enlaces clicables").

## Menú "Setup" → Servidores MCP (`.mcp.json`)

La opción "Servidores MCP" (`setupMcpServers` en
[`scripts/setup/actions.mjs`](../scripts/setup/actions.mjs)) permite
registrar en un `.mcp.json` los servidores MCP que el coding agent
(Copilot / Visual Studio / VS Code) puede lanzar:

- **codegraph** — `codegraph serve --mcp` (requiere el CLI de CodeGraph instalado).
- **ado** — `npx -y @azure-devops/mcp <organización>` (organización por defecto:
  `<ORGANIZACION_ADO>`, configurable en el prompt).
- **codebase-memory** — `codebase-memory-mcp` (requiere el servidor instalado).

El flujo es:

1. Elegir **dónde** escribir la configuración:
   - Repo (`.mcp.json` en la raíz, compartido/versionable en git).
   - Usuario (`~/.mcp.json`, personal, no versionado).
2. Elegir qué servidores añadir/actualizar (uno, varios o "Los 3").
3. La CLI hace **merge aditivo**: lee el `.mcp.json` existente (si lo hay),
   añade/actualiza solo las claves de los servidores seleccionados dentro
   de `servers`, y preserva cualquier otra clave o servidor ya configurado.

```powershell
pnpm run tooling -- setup mcp [--yes|--no]
```

En modo `--yes`/`--no` (no interactivo) se asume siempre la última opción
de cada `select` (por convención, la salida/cancelación), por lo que este
subcomando en modo no interactivo no realiza cambios reales; úsalo en modo
interactivo para elegir scope y servidores.

Tras guardar, es necesario **reiniciar el coding agent** (Visual Studio /
VS Code) para que detecte los servidores MCP nuevos o actualizados.

Helpers reutilizables en `scripts/doctor/checks.mjs`:
`MCP_CONFIG_REPO_FILE`, `MCP_CONFIG_USER_FILE`, `MCP_SERVER_DEFS`,
`ADO_DEFAULT_ORG`, `readMcpConfig(filePath)`, `mergeMcpServers(filePath, servers)`.

## Menú "Doctor"

Ejecuta `runAllChecks()` (ver `scripts/doctor/checks.mjs`) y muestra el
estado del entorno: RTK, proveedor de code-graph configurado
(`.agents/config.json`), CodeBase memory MCP, skills esperadas, corpus
vectorizado, dependencias node.

```powershell
pnpm run tooling -- doctor
pnpm run tooling -- doctor --deep   # checks adicionales, más lentos
pnpm run tooling -- doctor --json   # salida JSON apta para scripts/CI
```

## Menú "Setup"

| Opción | Acción | Función |
|---|---|---|
| RTK | Instala/verifica RTK (winget o guía manual) | `setupRtk` |
| CodeGraph (CLI fallback) | Instala/verifica CodeGraph | `setupCodegraph` |
| CodeBase memory (servidor MCP) | Submenú: instalar, ver guía, levantar UI, auto-index, indexar proyecto | `setupCodebaseMemory` |
| Skills básicas | Instala skills propietarias + gestionadas por `skills-lock.json` | `setupSkills` |
| Todo | Ejecuta las cuatro anteriores en orden | `setupAll` |

### Submenú CodeBase memory

- **Instalar (guiado)**: descarga y ejecuta el instalador oficial
  (`install.ps1` del repo `DeusData/codebase-memory-mcp`).
- **Ver guía de instalación**: imprime los pasos manuales + enlace al
  repositorio, sin ejecutar nada.
- **Levantar UI**: lanza `codebase-memory-mcp --ui=true --port=9749` en
  background (ver "Arranque en background en Windows" más abajo) y
  verifica que el puerto responda con reintentos (hasta 8s). Si tiene
  éxito, muestra la URL como enlace clicable: `http://localhost:9749`.
- **Habilitar/Deshabilitar auto_index**: usa
  `codebase-memory-mcp config get/set auto_index`.
- **Indexar proyecto**: usa
  `codebase-memory-mcp cli index_repository` pasando `{"repo_path": "..."}`
  como argumento JSON vía `execFileSync` (evita problemas de escaping de
  shell con comillas anidadas).

## Menú "Run"

| Opción | Comando subyacente | Función |
|---|---|---|
| Indexación del corpus | `pnpm run vectorize:project` | `runVectorize` |
| Instalación de dependencias node | `pnpm install` | `runInstallDeps` |
| Ambas | install + vectorize | `runAll` |
| Query de prueba contra el corpus | `pnpm run vectorize:test [-- "query"]` | `runVectorizeTest` |
| Búsqueda semántica en el corpus | `pnpm run memory:lookup -- "query" --human` | `runMemoryLookup` |
| Lectura de fichero con cache | `pnpm run memory:file-read -- <path\|--cache-stats\|--revalidate\|--clear-cache>` | `runMemoryFileRead` |
| Cache semántica de prompts | `pnpm run memory:semantic-cache -- <stats\|clear>` | `runMemorySemanticCache` |

Notas:

- **Query de prueba** y **búsqueda semántica** piden el texto de la query
  mediante un prompt de texto libre (`io.input`). Si se deja vacío en
  "vectorize:test", se usa el set de queries de ejemplo definido en el
  propio script; en "memory:lookup" una query vacía se considera
  omitida (no tiene sentido buscar sin texto).
- **Lectura de fichero con cache** ofrece un submenú: leer un fichero
  puntual (pide el path), ver estadísticas de la cache, revalidar toda
  la cache contra disco, o vaciarla.
- **Cache semántica de prompts** solo expone `stats` y `clear` desde el
  menú interactivo (operaciones simples, sin parámetros). Los
  subcomandos `put`/`get` (que requieren `--prompt`, `--value`, etc.) se
  siguen pudiendo invocar directamente:
  ```powershell
  pnpm run memory:semantic-cache -- put --prompt "..." --value "..."
  pnpm run memory:semantic-cache -- get --prompt "..." --top 3
  ```

## Enlaces clicables

`scripts/doctor/checks.mjs` exporta `hyperlink(url, text?)`, que envuelve
el texto con la secuencia de escape OSC 8. Terminales modernos (Windows
Terminal, terminal integrada de VS Code, iTerm2, etc.) lo renderizan como
un enlace clicable; en terminales sin soporte, la secuencia se ignora y
solo se ve el texto plano. Se usa tanto en los logs en vivo de las
acciones (p.ej. al levantar la UI de CodeBase memory) como en el resumen
final que imprime `printSetupResult` en `tooling.mjs` cuando el `hint`
de un resultado es una URL (`^https?://`).

## Arranque en background en Windows (`spawnDetached`)

`codebase-memory-mcp --ui=true --port=9749` necesita quedar vivo tras
salir del proceso Node de la CLI. En Windows, ni
`child_process.spawn({ detached: true })` ni `Start-Process` de
PowerShell lanzado vía `execFileSync` desde ese mismo proceso Node son
suficientes: el proceso de la CLI corre dentro de un **Job Object**
heredado de la terminal (con la política "kill on job close"), y
cualquier proceso hijo/nieto queda atado al mismo Job Object y muere en
cuanto termina el padre.

La solución aplicada en `spawnDetached` (`scripts/doctor/checks.mjs`) usa
**`Win32_Process.Create` vía WMI** (`Invoke-CimMethod`) en Windows: el
proceso lo crea el servicio WMI, fuera del árbol/Job Object de la
terminal, por lo que sobrevive de forma real. En otros sistemas
operativos se mantiene el `child_process.spawn` nativo con
`detached: true`.

## Banner ASCII

El título "AI-SDD Tooling" se genera dinámicamente con
[`figlet`](https://www.npmjs.com/package/figlet) (fuente `Small`) en
`banner()` (`scripts/cli/tooling.mjs`). Si `figlet` no pudiera renderizar
la fuente por algún motivo (entorno raro, fuente no encontrada), se cae a
imprimir el título en texto plano dentro del mismo recuadro, para no
romper la CLI.

## Convenciones

- En todos los submenús, la última entrada es siempre la salida
  ("← Volver" / "← Cancelar" / "Salir"). Esto es lo que permite que el
  modo `--yes`/`--no` sea determinista: `io.select` en modo no
  interactivo siempre devuelve `choices[choices.length - 1]`.
- "Volver" en un submenú regresa al menú padre (nunca cierra la CLI).
- Las acciones nunca llaman directamente a `console.log`/`inquirer`:
  todo pasa por el objeto `io`, para poder testear/reutilizar la lógica
  sin una terminal interactiva real.
