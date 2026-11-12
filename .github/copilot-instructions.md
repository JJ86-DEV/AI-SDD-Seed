# Copilot Instructions

Semilla de **AI-SDD** (Spec/Software-Driven Development con prompt engineering) para .NET 10 con arquitectura por capas (DDD / Clean Architecture). Misma base que `CLAUDE.md`, adaptada a GitHub Copilot.

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

## Agentes y skills (Copilot)

- Agentes: `.github/agents/` (`archiecture-memory`, `cache-gate`, `request-gate`, `compliance-gate`).
- Skills: `.agents/skills/`.
- Configuración del proveedor de navegación de código: `.agents/config.json`.

## Mantenimiento de la paridad Copilot / Claude

El contenido de `.github/agents` y `.claude/agents`, y de `.agents/skills` y `.claude/skills`, debe mantenerse equivalente. Al cambiar uno, actualizar el otro.
