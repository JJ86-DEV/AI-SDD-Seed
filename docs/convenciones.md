# Convenciones de código (.NET/C#)

> Documento **starter**: destilado de las skills `dotnet-best-practices` y `ef-core`
> más la estructura real del repo. A refinar por el equipo.

## Naming y estructura

- Namespaces alineados con la estructura de carpetas y capas (`Domain`, `Application`, `Infrastructure`, `Api`).
- Interfaces prefijadas con `I` (`IUserRepository`, `IEmailService`).
- Nombres que reflejan conceptos de dominio, no técnicos genéricos.
- `GlobalUsings.cs` por proyecto para usings comunes.

## Documentación

- XML docs (`/// <summary>`) en todas las clases, interfaces, métodos y propiedades públicas.
- Incluir `<param>` y `<returns>` donde aplique.

## Diseño y patrones

- **DI por constructor**; usar *primary constructor* cuando encaje (`public class Svc(IDep dep)`).
- Validar dependencias no nulas (`ArgumentNullException`) cuando el primary constructor no lo cubra.
- Interface segregation; contratos en `Application/Interfaces`, implementaciones en `Infrastructure`.
- Factory pattern para creación compleja de objetos.

## Async / await

- `async`/`await` en toda I/O (EF Core, HTTP, ficheros, Graph).
- Métodos async devuelven `Task` / `Task<T>`.
- `ConfigureAwait(false)` en librería (Application/Infrastructure) donde sea apropiado.
- Nunca bloquear con `.Result` / `.Wait()`.

## Entity Framework Core

- `DbContext` cohesivo; configuración con **Fluent API** en `OnModelCreating` / `IEntityTypeConfiguration` (mantiene el `Domain` limpio de anotaciones EF).
- Lecturas: `AsNoTracking()`.
- Paginación con `Skip()`/`Take()` (ver `Domain/Pagination`).
- Evitar N+1: `Include()` o proyección (`Select`) a DTOs de `Application/Projections`.
- Migraciones pequeñas y descriptivas; verificar el SQL antes de aplicar a producción.

## Configuración

- Clases de configuración tipadas con data annotations (`Required`, etc.).
- Binding desde `appsettings.json` vía `IConfiguration`.

## Errores y logging

- Logging estructurado con `Microsoft.Extensions.Logging` y scopes con contexto.
- Excepciones específicas y descriptivas; errores HTTP como ProblemDetails (RFC 7807).

## Testing

- **MSTest** + **FluentAssertions** + **Moq**.
- Patrón **AAA** (Arrange, Act, Assert).
- Cubrir éxito y fallo, incluida validación de parámetros nulos.
- EF: provider in-memory para unit tests; SQLite para integración.

## Seguridad y rendimiento

- Consultas parametrizadas; cuidado con SQL crudo.
- Validación y saneamiento de entrada.
- Features de C# 12+/.NET 10 donde aporten.

## Calidad

- SOLID; evitar duplicación con clases base/utilidades.
- Métodos cohesivos y enfocados; `IDisposable`/`IAsyncDisposable` para recursos.
