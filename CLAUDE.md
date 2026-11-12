# CLAUDE.md

Semilla de **AI-SDD** (Spec/Software-Driven Development con prompt engineering) para .NET 10 con arquitectura por capas (DDD / Clean Architecture). Misma base que `.github/copilot-instructions.md`, adaptada a Claude Code.

## Preferencias del usuario

- No incluir nunca datos sensibles (connection strings, keys, tokens) en el código. Si el usuario los proporciona en el chat, aplicarlos en configuración local pero advertir que deben ir a KeyVault/secrets en producción.
- Responder en español.

## Documentación obligatoria (leer antes de cambiar código)

- `docs/arquitectura-aplicacion.md`: capas, regla de dependencias y dónde va cada cosa.
- `docs/convenciones.md`: convenciones de código .NET/C#.
- `docs/stack.md`: stack tecnológico.
- `docs/diario-arquitectura.md`: decisiones de arquitectura (ADR ligero, entradas nuevas arriba).
- `docs/architecture-compliance-protocol.md` y `docs/architecture-memory-agent-overview.md`: protocolo de agentes y quality gates.
- `docs/tooling.md`: CLI de preparación del entorno (`pnpm run tooling`).

## Estructura

```
src/Domain          Núcleo del dominio. No referencia a nadie.
src/Application     Casos de uso, interfaces, DTOs. Referencia a Domain.
src/Infrastructure  DbContext, repositorios, servicios externos. Referencia a Application y Domain.
src/Api             Presentación HTTP y composición (DI). Referencia a todas.
tests/UnitTests     Tests unitarios.
```

Regla dura: las dependencias apuntan siempre hacia dentro. Detalle en `docs/arquitectura-aplicacion.md`.

## Agentes y skills (Claude)

- Agentes: `.claude/agents/` (`architecture-memory`, `cache-gate`, `request-gate`, `compliance-gate`, `code-review`, `spec-generator`, `spec-implementer`).
- Skills: `.claude/skills/` (incluye `sonar-cleanup`, que se apoya en `.github/agents/sonar-cleanup.agent.md`).
- Specs (SDD): `.github/specs/` (reglas en `_shared/`). Flujo: `spec-generator` → `spec-implementer` → `code-review`.
- Calidad: pipeline `azure-pipelines.yml` (build, tests, cobertura y SonarQube con variables genéricas) y hook `.githooks/pre-commit` (se instala con `scripts/code-review/setup-hooks.*`).
- Configuración del proveedor de navegación de código: `.agents/config.json`.

Los agentes se escribieron originalmente para Copilot. Equivalencias en Claude Code:

| Copilot | Claude Code |
|---|---|
| `runSubagent` / `agentName` | herramienta `Task` con el subagente |
| `vscode/askQuestions` | `AskUserQuestion` / pregunta directa |
| `execute/runInTerminal` | `Bash` |
| `read/readFile`, `edit/editFiles` | `Read`, `Edit`, `Write` |
| `search/fileSearch` | `Glob`, `Grep` |

## Mantenimiento de la paridad Copilot / Claude

El contenido de `.github/agents` y `.claude/agents`, y de `.agents/skills` y `.claude/skills`, debe mantenerse equivalente. Al cambiar uno, actualizar el otro. Los scripts de `scripts/` leen las skills desde `.agents/skills`.

## Comandos habituales

```powershell
pnpm install
pnpm run tooling                # menú interactivo (doctor, setup, run)
pnpm run vectorize:project      # indexa docs/ y skills en vectorized/
pnpm run memory:lookup -- "consulta" --human
dotnet build
dotnet test
```
