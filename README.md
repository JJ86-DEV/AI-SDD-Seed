# AI-SDD-Seed

Semilla personal para proyectos .NET 10 con arquitectura por capas (DDD / Clean Architecture) y una estructura de **prompt engineering orientada a SDD** para dos asistentes de IA:

| Asistente | Instrucciones | Agentes | Skills |
|---|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/agents/` | `.agents/skills/` |
| Claude Code | `CLAUDE.md` | `.claude/agents/` | `.claude/skills/` |

Ambos comparten el mismo contenido de base en `docs/` (arquitectura, convenciones, stack, diario de decisiones, protocolo de gates).

## Contenido

```
src/{Domain,Application,Infrastructure,Api}   Capas vacías con carpetas esperadas
tests/UnitTests                               Proyecto MSTest vacío
docs/                                         Documentación base para los agentes
.agents/                                      Skills y config del proveedor de code-graph
.github/                                      Copilot: instrucciones + agentes
.claude/                                      Claude: agentes + skills
scripts/                                      CLI de tooling, vectorización y memoria semántica
```

## Uso de la semilla

1. Copiar la carpeta con un nuevo nombre y renombrar la solución (`AI-SDD-Seed.sln`).
2. Buscar y sustituir los placeholders `<RUTA_PROYECTO>`, `<NOMBRE_PROYECTO_INDEXADO>`, `<NombreSolucion>` y `<ORGANIZACION_ADO>`.
3. Rellenar `docs/stack.md` y reiniciar `docs/diario-arquitectura.md`.
4. `pnpm install` y `pnpm run tooling` para preparar el entorno.
5. `pnpm run vectorize:project` para indexar `docs/` y las skills.

Más detalle en `README-memory.md` y `docs/tooling.md`.
