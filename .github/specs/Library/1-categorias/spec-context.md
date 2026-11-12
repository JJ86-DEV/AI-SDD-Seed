# Contexto — 1-categorias

## Sección del funcional a cubrir

`.github/specs/_shared/functional.md`: secciones **2** (convenciones transversales), **3** (entidad Category) y **4.1** (Categorías).

## Specs previas

Ninguna. **Es la feature piloto**: al implementarla se fija el patrón de capas que replicarán las demás
(entidad, configuración EF, repositorio, servicio, DTOs, mappings, controlador, DI y tests).

## Base ya existente en el código

- `Domain/Pagination/PaginationCriteria.cs` y `PagedResult.cs`; `Domain/Filters/Common/SortingCriteria.cs`.
- `Infrastructure/Contexts/ApplicationDbContext.cs` (aplica todas las `IEntityTypeConfiguration` del ensamblado).
- `Infrastructure/Extensions/ServiceCollectionExtensions.cs` (`AddInfrastructure`) y `Application/Extensions/ServiceCollectionExtensions.cs` (`AddApplication`).
- `Api/Program.cs` con controladores, OpenAPI y ProblemDetails.
- Convenciones de estructura en `docs/arquitectura-aplicacion.md` y `docs/convenciones.md`.

## Restricciones de alcance

- Solo la entidad `Category` y sus endpoints (crear, obtener, actualizar, eliminar, listar).
- La regla "no eliminar con libros asociados" se **deja preparada** pero aún no se puede comprobar (la entidad `Book` llega en `3-libros`): documentarlo como suposición y definir el punto de extensión.
- Sin migraciones: el esquema lo crea `EnsureCreated` en Development.
