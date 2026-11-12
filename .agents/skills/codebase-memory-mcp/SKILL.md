---
name: codebase-memory-mcp
description:
  Use codebase-memory-mcp (the project's knowledge-graph MCP server over the C# source in `src/`) for ANY work involving source code (`.cs`): locating a symbol, finding callers/callees, tracing data flow or cross-service paths, impact analysis, understanding project structure, or before any edit on source code. It is the DEFAULT code-graph provider (see `.agents/config.json`). Triggers when the user asks "where is X defined", "who calls X", "trace this flow", "what's the architecture", or before any surgical/architectural code change.
---

# codebase-memory-mcp

`codebase-memory-mcp` is the **default** provider for navigating C# source code in this project (`.agents/config.json` → `codeGraphProvider: "codebase-memory-mcp"`). It exposes a pre-indexed **knowledge graph** of the code via MCP tools that return path + qualified name + line ranges + call/data-flow trails **without reading whole files** — cheaper than ad-hoc file exploration.

The alternative provider is `codegraph` (CLI, fallback). Only use it if `.agents/config.json` sets `codeGraphProvider: "codegraph"`; then follow the skill `codegraph-architecture-agent` instead.

---

## Tool naming across hosts

The tools are referenced **by function**; the exact token depends on the host:

- **VS 2026 / VS Code (Copilot agents)**: appear under the `codebase-memory-mcp` MCP server tool group. Enable the server for the agent; call the tools by their base name (`search_graph`, `trace_path`, …).
- **Claude Code**: exposed with the prefix `mcp__codebase-memory-mcp__` (e.g. `mcp__codebase-memory-mcp__search_graph`).

This skill documents the **base names and their contract**. The agents refer to capabilities ("localizar símbolo", "trazar llamadas") and resolve the concrete tool through this skill.

---

## Tools disponibles

| Tool | Propósito | Parámetros clave |
|---|---|---|
| `search_graph` | Localizar símbolos (clases, métodos, rutas) en el grafo | `name_pattern`, `label`, `qn_pattern` |
| `search_code` | Búsqueda de texto aumentada por grafo (grep + contexto) | `pattern` |
| `get_code_snippet` | Código fuente exacto de un símbolo por nombre cualificado | `qualified_name` |
| `trace_path` | Trazar cadenas: llamadas, flujo de datos, cross-service | `function_name`, `mode=calls\|data_flow\|cross_service` |
| `query_graph` | Consulta Cypher para patrones complejos del grafo | `query` |
| `get_architecture` | Estructura/arquitectura del proyecto | `aspects` |
| `get_graph_schema` | Esquema del grafo (labels, relaciones) | — |
| `index_repository` | Indexar el repo (si no está indexado) | — |
| `index_status` | Estado del índice | — |
| `detect_changes` | Detectar cambios desde el último indexado | — |
| `list_projects` | Proyectos indexados | — |
| `manage_adr` | Gestionar ADRs en el grafo | — |

---

## Cuándo usar cada tool

| Necesito… | Tool |
|---|---|
| Localizar dónde está una clase/método | `search_graph` (name_pattern / qn_pattern) |
| Ver el código exacto de un símbolo | `get_code_snippet` (qualified_name) |
| Saber quién llama a X antes de modificarlo | `trace_path` (mode=calls) |
| Entender el flujo de datos de X | `trace_path` (mode=data_flow) |
| Ver dependencias entre servicios/capas | `trace_path` (mode=cross_service) |
| Entender la estructura del proyecto | `get_architecture` (aspects) |
| Un patrón complejo (varias relaciones) | `query_graph` (Cypher) |
| Grep con contexto de grafo | `search_code` (pattern) |

**Regla:** antes de **modificar** un símbolo público, `trace_path mode=calls` para el blast radius. Antes de **entender** un flujo cross-capa, `trace_path mode=data_flow`/`cross_service`. Antes de un edit de bytes exactos, `get_code_snippet` para confirmar la firma.

En este proyecto Clean Architecture, `trace_path mode=cross_service` es útil para verificar la **dirección de dependencias** (`Api → Application → Domain`, `Infrastructure → Application/Domain`) antes de un cambio cross-capa.

---

## Estado del índice

Antes del primer uso en una sesión, confirma que el repo está indexado:

```
index_status
```

Si no está indexado (o `search_graph` viene vacío para símbolos que sabes que existen):

```
index_repository
```

No re-indexes por inercia — el indexado se paga una vez. Usa `detect_changes` para saber si el índice está desfasado tras cambios grandes.

---

## Cuándo NO usarlo

`codebase-memory-mcp` indexa **código** (`.cs`). No lo uses para:

- Documentación (`.md`), READMEs, skills → usa `memory:lookup` (corpus vectorizado).
- Configuración (`appsettings.json`, `.csproj`, `*.yml`) → usa `memory:file-read`.
- Leer un fichero completo por path conocido → usa `memory:file-read`.

Si `search_graph` viene vacío, normalmente **no** significa "no existe": significa índice desfasado o fuera de scope. Verifica con `index_status` antes de concluir.

---

## Antipatterns

1. **Query abierta multi-símbolo en `search_graph`.** Una query concreta (`name_pattern: "UserRepository"`) > 5-10 keywords encadenadas.
2. **Asumir vacío = no existe.** Verifica `index_status`; puede estar sin indexar o desfasado.
3. **Re-indexar por inercia.** `index_status` ya dice si está sano. `index_repository` es caro.
4. **Saltarse el grafo y `read_file` sobre `.cs`.** Con índice, `get_code_snippet` es más barato: path+líneas exactas sin abrir el fichero.
5. **Usarlo para docs/configs.** No indexa `.md`/`.json`; para eso `memory:lookup` / `memory:file-read`.

---

## Verificación rápida

```
index_status                                  # ¿está sano el índice?
search_graph  name_pattern="Repository"       # ¿localiza símbolos?
get_architecture aspects=["layers"]           # ¿ve la estructura?
trace_path function_name="..." mode=calls     # ¿traza llamadas?
```

---

## Resumen ejecutivo

1. Proveedor **por defecto** para código `.cs` (`.agents/config.json`).
2. Antes de modificar: `search_graph` + `get_code_snippet` (firma) + `trace_path mode=calls` (blast radius).
3. Antes de entender un flujo: `trace_path mode=data_flow` / `cross_service`.
4. Estructura: `get_architecture`. Patrón complejo: `query_graph` (Cypher).
5. Si viene vacío: `index_status`; `index_repository` solo si falta. No re-indexar por inercia.
6. No para docs/configs → `memory:lookup` / `memory:file-read`.
