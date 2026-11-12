---
name: codegraph-architecture-agent
description:
  Use CodeGraph (CLI knowledge graph of the C# source in `src/`) as the FALLBACK code-graph provider for any work involving source code (`.cs`): locating a symbol, finding callers/callees, impact analysis, understanding cross-file flow, or before any edit on source code. Only active when `.agents/config.json` sets `codeGraphProvider: "codegraph"`; the DEFAULT provider is `codebase-memory-mcp`. Triggers when the user asks "where is X defined", "who calls X", "impact of changing X", or before any surgical/architectural code change while CodeGraph is the selected provider.
---

# CodeGraph (proveedor fallback)

CodeGraph is a CLI-indexed knowledge graph of the source code (`.cs`) in this project. It returns path + signature + line numbers + dependency trails **without reading the file**, which makes it cheaper than ad-hoc file exploration for any operation that needs to navigate the codebase.

> **Este es el proveedor FALLBACK.** El proveedor por defecto es `codebase-memory-mcp` (ver skill `codebase-memory-mcp` y `.agents/config.json`). Usa CodeGraph **solo** cuando `.agents/config.json` tenga `codeGraphProvider: "codegraph"`.

This skill documents how to use CodeGraph in isolation: its commands, its scope, and its failure modes. It does not depend on other tooling.

---

## Estado del índice

```bash
rtk pnpm dlx @colbymchenry/codegraph status
```

If the index is missing or stale:

```bash
rtk pnpm dlx @colbymchenry/codegraph init
```

Do not re-index unless `status` reports it as stale or absent — indexing is paid once, not on every query.

---

## Comandos disponibles

| Comando | Propósito | Salida |
|---|---|---|
| `codegraph_search "<query>"` | Localizar un símbolo por nombre (parcial o exacto) | Lista de matches con path + línea + score |
| `codegraph node <símbolo\|file>` | Símbolo o archivo concreto: ubicación, firma, callers/callees, cuerpo (`includeCode=true`) | Resumen estructurado |
| `codegraph callers <símbolo>` | Quién llama a X (call-sites) — usar antes de modificar | Lista archivo:línea |
| `codegraph callees <símbolo>` | Qué llama X internamente — flujo de una función | Árbol recursivo |
| `codegraph impact <símbolo>` | Impacto transitivo — antes de refactorizar | Archivos/líneas afectadas |
| `codegraph status` | Estado del índice | Nodos/edges y salud |

### Disambiguación de nombres

Cuando un símbolo está sobrecargado (mismo nombre en varias clases/archivos), `codegraph node` devuelve todas las definiciones. Para fijar la exacta, pasar `file` (path o basename) y opcionalmente `line`:

```text
codegraph node <símbolo> file=<path> line=<n>
```

---

## Cuándo usar cada comando

| Necesito… | Comando |
|---|---|
| Localizar dónde está un símbolo | `codegraph_search "<nombre>"` |
| Confirmar la firma antes de un edit | `codegraph node <símbolo\|file>` |
| Ver qué llama a X antes de modificarlo | `codegraph callers X` |
| Entender el flujo interno de un método | `codegraph callees X` (recursivo) |
| Evaluar el blast radius de un refactor | `codegraph impact X` |

**Regla:** si vas a **modificar** un símbolo público, `codegraph callers` antes de tocar. Para **entender** un flujo cross-fichero, `codegraph callees` recursivo. Para **refactorizar** con cambio de firma, `codegraph impact`.

---

## Cuándo NO usar CodeGraph

CodeGraph solo indexa `.cs`. **No** lo uses para:

- Documentación (`.md`), READMEs, skills → usa `memory:lookup`.
- Configuración (`.json`, `.yml`, `.csproj`, `appsettings.json`) → usa `memory:file-read`.
- Código en `bin/`, `obj/`, `node_modules/` → no indexado.

Si `codegraph_search` viene vacío, normalmente **no** significa "no existe" — significa fuera de scope o índice desfasado. Verifica con `codegraph status`.

---

## Antipatterns

1. **Query abierta / multi-símbolo.** `codegraph_search "user auth login session token"` diluye el match. Usa `codegraph_search "UserRepository"`.
2. **Asumir vacío = no existe.** Verifica `codegraph status` y el scope del fichero.
3. **Re-indexar por inercia.** Cada `init` paga un indexado completo. `status` ya dice si está stale.
4. **Saltarse CodeGraph y leer el archivo.** Con índice, `codegraph node` es más barato que abrir el `.cs`.
5. **Ignorar la disambiguación `file:line`** en símbolos sobrecargados.

---

## Verificación rápida

```bash
rtk pnpm dlx @colbymchenry/codegraph status
rtk pnpm dlx @colbymchenry/codegraph search "UserRepository"
rtk pnpm dlx @colbymchenry/codegraph callers "GetByIdAsync"
rtk pnpm dlx @colbymchenry/codegraph impact "GetByIdAsync"
```

---

## Resumen ejecutivo

1. Proveedor **fallback** para `.cs` (default: `codebase-memory-mcp`).
2. Antes de modificar: `codegraph_search` + `codegraph node` (firma).
3. Antes de refactorizar: `codegraph impact` + `codegraph callers`.
4. Antes de entender un flujo: `codegraph callees` recursivo.
5. Si viene vacío: verifica scope e índice (`status`), no asumas "no existe".
6. No para docs/configs → `memory:lookup` / `memory:file-read`.
