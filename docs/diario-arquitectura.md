# Diario de arquitectura (ADR ligero)

> Bitácora de decisiones arquitectónicas del proyecto. Cada entrada es un
> ADR ligero: contexto, decisión, alternativas descartadas y consecuencias.
> Se indexa en el corpus para que el agente conozca el *por qué* de las cosas,
> no solo el *qué*. Añade entradas nuevas arriba (orden cronológico inverso).

## Plantilla de entrada

```
## YYYY-MM-DD — Título corto de la decisión

**Contexto:** qué problema o necesidad la motiva.
**Decisión:** qué se decide hacer (imperativo, concreto).
**Alternativas descartadas:** opciones consideradas y por qué se rechazan.
**Consecuencias:** qué implica (coste, deuda, restricciones futuras).
**Estado:** propuesta | aceptada | reemplazada por [otra entrada].
```

## 2026-07-07 — Adopción del sistema de memoria vectorizada + caché semántica

**Contexto:** el proyecto base .NET necesita dar a los agentes de IA (Copilot en
VS 2026 / VS Code) memoria del proyecto (docs, skills, convenciones) sin quemar
tokens re-explorando en cada sesión.

**Decisión:** portar desde el proyecto base Vue el pipeline de vectorización
(`scripts/vectorize`), la caché semántica y el lector cacheado (`scripts/memory`),
con corpus indexado dinámicamente desde `docs/` y `.agents/skills/`. Proveedor de
navegación de código conmutable vía `.agents/config.json`, por defecto
`codebase-memory-mcp`.

**Alternativas descartadas:** mantener `codegraph` como único proveedor (se deja
como fallback); indexado hardcodeado de docs (se sustituye por glob dinámico).

**Consecuencias:** requiere `pnpm install` y una primera vectorización (descarga del
modelo bge-m3 ~570 MB, cacheado en `~/.cache/huggingface`). El corpus (`vectorized/`)
queda fuera de git.

**Estado:** aceptada.
