# Milestones — 1-categorias

| # | Hito / Tarea | Descripción | Tipo | Estado |
|---|---|---|---|---|
| 1 | Entidad `Category` | Crear `Category.cs` en `Domain/Entities/` | Entidad | Completado |
| 2 | Constantes | Crear `CategoryConstants.cs` en `Domain/Constants/` (`NameMaxLength=80`, `DescriptionMaxLength=500`) | Constante | Completado |
| 3 | Filtro | Crear `CategoryFilter.cs` en `Domain/Filters/Categories/` | DTO Filtro | Completado |
| 4 | DTOs | Crear `CategoryDto`, `CreateCategory`, `UpdateCategory` en `Application/Models/Categories/` con data annotations | DTO | Completado |
| 5 | Excepciones | Crear `NotFoundException`, `ConflictException`, `ValidationException` en `Application/Exceptions/` | Validación | Completado |
| 6 | Mappings | Crear `CategoryMappings.cs` (`ToDto`, `ToEntity`, `ApplyTo`) en `Application/Mappings/` | Mapping | Completado |
| 7 | Interfaces | Crear `ICategoryRepository`, `ICategoryService`, `ICategoryDeletionGuard` en `Application/Interfaces/` | Interfaz | Completado |
| 8 | Servicio | Crear `CategoryService.cs` en `Application/Services/` (normalización, unicidad, guard, paginación, validación de `sortBy`) | Servicio | Completado |
| 9 | Configuración EF | Crear `CategoryConfiguration.cs` (tabla, longitudes, `NOCASE`, índice único) y añadir `DbSet<Category>` en `ApplicationDbContext` | Configuración EF | Completado |
| 10 | Migración | N/A: sin migraciones, el esquema lo crea `EnsureCreated` en Development | Migración | Completado |
| 11 | Repositorio | Crear `CategoryRepository.cs` en `Infrastructure/Repositories/` (filtro, orden, paginación, traducción de `DbUpdateException` a `ConflictException`) | Servicio | Completado |
| 12 | Guard de borrado | Crear `NoBooksCategoryDeletionGuard.cs` en `Infrastructure/Services/` (siempre `false`; punto de extensión para `3-libros`) | Servicio | Completado |
| 13 | Manejo de errores | Crear `ApplicationExceptionHandler.cs` (`IExceptionHandler`) en `Api/Middlewares/` y registrarlo en `Program.cs` | Endpoint | Completado |
| 14 | Controller | Crear `CategoriesController.cs` en `Api/Controllers/` con `CreateCategory`, `GetCategory`, `UpdateCategory`, `DeleteCategory`, `ListCategories` | Endpoint | Completado |
| 15 | Registro DI | Registrar servicio en `AddApplication` y repositorio y guard en `AddInfrastructure` | Modificar | Completado |
| 16 | Tests de mappings | `CategoryMappingsTests` | Test | Completado |
| 17 | Tests de servicio | `CategoryServiceTests`: éxito, `404`, `409` (duplicado y libros), `400`, normalización de paginación | Test | Completado |
| 18 | Tests de repositorio | `CategoryRepositoryTests` con EF in-memory: filtro, orden, paginación, vacío, `ExistsByNameAsync` | Test | Completado |
| 19 | Tests de controller y handler | `CategoriesControllerTests` (201/200/204, `Location`) y `ApplicationExceptionHandlerTests` (400/404/409) | Test | Completado |
| 20 | Dependencias de tests | Añadir `Microsoft.EntityFrameworkCore.InMemory` y referencias de proyecto a `tests/UnitTests` | Modificar | Completado |
| 21 | Validación: `dotnet build` | Compilación sin errores ni warnings nuevos | Validación | Completado |
| 22 | Validación: `dotnet test` | Todos los tests en verde | Validación | Completado |
