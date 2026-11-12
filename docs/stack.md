# Stack tecnológico

> Documento **starter** de la semilla. Rellenar según evolucione el proyecto.

## Plataforma

- **.NET 10** (`TargetFramework: net10.0`) en todos los proyectos.
- **C# 12+** con `GlobalUsings.cs` por proyecto.
- Solution: `AI-SDD-Seed.sln` (renombrar al instanciar la semilla).

## Proyectos

- `src/Domain`, `src/Application`, `src/Infrastructure`, `src/Api`.
- `tests/UnitTests` (MSTest).

## Persistencia

- Pendiente de decidir (EF Core recomendado; ver skill `ef-core`).

## API web

- ASP.NET Core (`src/Api/Program.cs`).
- Pendiente: versionado, OpenAPI, ProblemDetails (RFC 7807).

## Autenticación

- Pendiente de decidir.

## Testing

- **MSTest** + **FluentAssertions** + **Moq** (ver skill `dotnet-best-practices`).

## Tooling de IA

- Node + pnpm para `scripts/` (vectorización, memoria semántica, CLI de tooling).
- Ver `docs/tooling.md`.

