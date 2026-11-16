# Spec 1-categorias — CRUD y listado de Categorías (feature piloto)

Fuente: `.github/specs/_shared/functional.md` secciones 2, 3 y 4.1. Specs previas: ninguna.
Esta feature **fija el patrón de capas** que replicarán `2-autores`, `3-libros` y `4-prestamos`.

---

## 1. Resumen funcional

CRUD completo de la entidad `Category` más un listado paginado con filtro por nombre y ordenación por `name`.

- Tipología: CRUD + listado paginado (`POST api/categories/list`).
- Reglas: nombre obligatorio, máx. 80, único sin distinguir mayúsculas (`409` si se duplica); descripción opcional, máx. 500.
- Eliminar una categoría con libros asociados debe dar `409`. La entidad `Book` no existe aún (`3-libros`): se deja un **punto de extensión** (`ICategoryDeletionGuard`) cuya implementación actual siempre devuelve `false`.

Estado del código base (no se redefine): `Domain.Pagination.PaginationCriteria` (`CurrentPage=1`, `PageSize=20`), `Domain.Pagination.PagedResult<T>` (`Items`, `CurrentPage`, `PageSize`, `TotalCount`, `TotalPages`), `Domain.Filters.Common.SortingCriteria` (`SortBy`, `SortDesc`), `Infrastructure.Contexts.ApplicationDbContext` (aplica `ApplyConfigurationsFromAssembly`), `AddApplication()` y `AddInfrastructure(configuration)` (SQLite, `ConnectionStrings:Default`), `Program.cs` con `AddControllers`, `AddOpenApi`, `AddProblemDetails`, `UseExceptionHandler`, `UseStatusCodePages`.

---

## 2. Endpoints

Controlador: `Api/Controllers/CategoriesController.cs`, `[ApiController]`, `[Route("api/categories")]`, `[Produces("application/json")]`. No existe ningún controlador previo: este define el patrón (suposición S1). Los controladores solo orquestan y delegan en `ICategoryService`. Todos los métodos son `async`, reciben `CancellationToken`.

### 2.1 Crear categoría

- `POST api/categories` — `ActionName`: `CreateCategory`
- Entrada: `CreateCategory` en `[FromBody]` (obligatorio).
- Request:
```json
{ "name": "Ciencia ficción", "description": "Novelas de anticipación" }
```
- Response `201 Created`, cabecera `Location: /api/categories/{id}` (generada con `CreatedAtAction(nameof(GetCategory), new { id }, dto)`), body `CategoryDto`:
```json
{ "id": "3f2b8c1e-5d7a-4e0b-9a41-6c2d8f0e1a77", "name": "Ciencia ficción", "description": "Novelas de anticipación" }
```
- Códigos: `201`, `400` (validación), `409` (nombre duplicado), `500`.

### 2.2 Obtener por id

- `GET api/categories/{id}` — `ActionName`: `GetCategory`
- Entrada: `id` (`Guid`, `[FromRoute]`, obligatorio).
- Response `200` `CategoryDto` (mismo JSON que arriba).
- Códigos: `200`, `404`, `500`. Un `id` no `Guid` da `404` por restricción de ruta no cumplida o `400` por binding de `[ApiController]`; se usa `{id:guid}` en la ruta, por lo que resulta `404`.

### 2.3 Actualizar

- `PUT api/categories/{id}` — `ActionName`: `UpdateCategory`
- Entrada: `id` (`Guid`, `[FromRoute]`, obligatorio); `UpdateCategory` en `[FromBody]` (obligatorio). Semántica de reemplazo completo.
- Request:
```json
{ "name": "Ciencia ficción y fantasía", "description": null }
```
- Response `200` `CategoryDto` con los datos actualizados.
- Códigos: `200`, `400`, `404`, `409` (nombre ya usado por **otra** categoría), `500`.

### 2.4 Eliminar

- `DELETE api/categories/{id}` — `ActionName`: `DeleteCategory`
- Entrada: `id` (`Guid`, `[FromRoute]`, obligatorio).
- Response `204 No Content` sin body.
- Códigos: `204`, `404`, `409` (tiene libros asociados; hoy inalcanzable en runtime, ver 5), `500`.

### 2.5 Listar

- `POST api/categories/list` — `ActionName`: `ListCategories`
- Entrada:
  - `CategoryFilter` en `[FromBody]` (**opcional**; body ausente, vacío o `{}` = sin filtro).
  - `PaginationCriteria` en `[FromQuery]` (`currentPage`, `pageSize`; opcional, defaults 1 y 20).
  - `SortingCriteria` en `[FromQuery]` (`sortBy`, `sortDesc`; opcional).
- Request: `POST /api/categories/list?currentPage=1&pageSize=2&sortBy=name&sortDesc=false`
```json
{ "name": "ci" }
```
- Response `200` `PagedResult<CategoryDto>`:
```json
{
  "items": [
    { "id": "3f2b8c1e-5d7a-4e0b-9a41-6c2d8f0e1a77", "name": "Ciencia ficción", "description": "Novelas de anticipación" },
    { "id": "a1d4e6f2-0b3c-4c85-8d19-7e5f2a9b3c10", "name": "Ciencias", "description": null }
  ],
  "currentPage": 1,
  "pageSize": 2,
  "totalCount": 2,
  "totalPages": 1
}
```
- Códigos: `200`, `400` (`sortBy` no soportado), `500`. Sin resultados: `200` con `items: []`, `totalCount: 0`, `totalPages: 0`.

### 2.6 Formato común de errores (ProblemDetails, RFC 7807)

```json
{ "type": "https://tools.ietf.org/html/rfc9110#section-15.5.10", "title": "Conflict", "status": 409,
  "detail": "Ya existe una categoría con el nombre 'Ciencia ficción'." }
```
`400` de validación de DTO lo genera `[ApiController]` (`ValidationProblemDetails` con `errors`). Los `400`, `404` y `409` de negocio los genera el `IExceptionHandler` (sección 4.3). `401` no aplica (sin autenticación en esta versión).

---

## 3. Modelo de datos

### 3.1 Entidad `Domain/Entities/Category.cs` (namespace `Domain.Entities`)

| Propiedad | Tipo CLR | Nullability | Notas |
|---|---|---|---|
| `Id` | `Guid` | no nulo | PK, asignado en el servicio (`Guid.NewGuid()`) |
| `Name` | `string` | no nulo (`= string.Empty`) | máx. 80, único sin distinguir mayúsculas |
| `Description` | `string?` | nulo | máx. 500 |

Relaciones: una categoría tendrá muchos `Book` (se añade `ICollection<Book>` en `3-libros`; **no** se declara ahora).

### 3.2 Constantes `Domain/Constants/CategoryConstants.cs` (namespace `Domain.Constants`)

```csharp
public static class CategoryConstants
{
    public const int NameMaxLength = 80;
    public const int DescriptionMaxLength = 500;
}
```

### 3.3 Configuración EF (Fluent API)

`Infrastructure/Contexts/Configurations/CategoryConfiguration.cs` (`IEntityTypeConfiguration<Category>`, descubierta por `ApplyConfigurationsFromAssembly`):

- `ToTable("Categories")`; `HasKey(c => c.Id)`; `Id` con `ValueGeneratedNever()`.
- `Name`: `IsRequired()`, `HasMaxLength(CategoryConstants.NameMaxLength)`, `UseCollation("NOCASE")`.
- `Description`: `HasMaxLength(CategoryConstants.DescriptionMaxLength)`.
- `HasIndex(c => c.Name).IsUnique()` (hereda collation NOCASE: unicidad sin distinguir mayúsculas en SQLite).

`ApplicationDbContext`: añadir `public DbSet<Category> Categories => Set<Category>();`.

Nota: `NOCASE` en SQLite solo ignora mayúsculas ASCII. Con el provider in-memory (tests) no hay collation ni índice único, por lo que la unicidad se garantiza además por la comprobación del servicio (sección 4).

### 3.4 Migración

N/A en esta feature: sin migraciones; el esquema lo crea `EnsureCreatedAsync()` en Development (ya en `Program.cs`).

### 3.5 DTOs y relación con la entidad

| Tipo | Namespace / ruta | Propiedades |
|---|---|---|
| `CategoryDto` | `Application.Models.Categories` / `Application/Models/Categories/CategoryDto.cs` | `Guid Id`, `string Name`, `string? Description` |
| `CreateCategory` | `Application.Models.Categories` | `string Name` (`[Required]`, `[StringLength(80)]`), `string? Description` (`[StringLength(500)]`) |
| `UpdateCategory` | `Application.Models.Categories` | idéntico a `CreateCategory` |
| `CategoryFilter` | `Domain.Filters.Categories` / `Domain/Filters/Categories/CategoryFilter.cs` | `string? Name` |

Mappings (`Application/Mappings/CategoryMappings.cs`, clase estática `CategoryMappings`):
- `CategoryDto ToDto(this Category)`.
- `Category ToEntity(this CreateCategory)` (sin asignar `Id`; lo asigna el servicio).
- `void ApplyTo(this UpdateCategory, Category)` (copia `Name` y `Description`).

La entidad nunca se expone al exterior.

---

## 4. Lógica de negocio

### 4.1 Contratos

`Application/Interfaces/ICategoryRepository.cs`:
```csharp
Task<Category?> GetByIdAsync(Guid id, CancellationToken ct);               // tracking (para update/delete)
Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct); // sin distinguir mayúsculas
Task<PagedResult<Category>> ListAsync(CategoryFilter filter, PaginationCriteria paging, SortingCriteria sorting, CancellationToken ct); // AsNoTracking
Task AddAsync(Category category, CancellationToken ct);                    // guarda cambios
Task UpdateAsync(Category category, CancellationToken ct);                 // guarda cambios
Task DeleteAsync(Category category, CancellationToken ct);                 // guarda cambios
```
`Application/Interfaces/ICategoryService.cs`: `CreateAsync(CreateCategory)`, `GetAsync(Guid)`, `UpdateAsync(Guid, UpdateCategory)`, `DeleteAsync(Guid)`, `ListAsync(CategoryFilter, PaginationCriteria, SortingCriteria)`; todos con `CancellationToken`, devuelven `CategoryDto` / `PagedResult<CategoryDto>` / `Task`.

`Application/Interfaces/ICategoryDeletionGuard.cs` (punto de extensión): `Task<bool> HasBooksAsync(Guid categoryId, CancellationToken ct)`.
Implementación actual `Infrastructure/Services/NoBooksCategoryDeletionGuard.cs`: devuelve siempre `false`. `3-libros` la **sustituye** por una que consulte `Books` (cambiando el registro DI).

Excepciones (`Application/Exceptions/`): `NotFoundException`, `ConflictException`, `ValidationException` (todas con `message`; `ValidationException` incluye `SortBy` inválido). Nombre `ValidationException` en namespace `Application.Exceptions` (no confundir con `System.ComponentModel.DataAnnotations`).

### 4.2 Servicio `Application/Services/CategoryService.cs`

Primary constructor `(ICategoryRepository repository, ICategoryDeletionGuard deletionGuard)`; `ConfigureAwait(false)` en awaits.

- **Create**: normaliza (`Name.Trim()`, `Description` con `Trim()` y `null` si queda en blanco); si `Name` vacío → `ValidationException`; si `ExistsByNameAsync(name, null)` → `ConflictException`; asigna `Id = Guid.NewGuid()`; `AddAsync`; devuelve `ToDto`. Si `AddAsync` lanza `DbUpdateException` por índice único (carrera), el repositorio lo traduce a `ConflictException`.
- **Get**: `GetByIdAsync` o `NotFoundException`.
- **Update**: busca (`NotFoundException`); normaliza; `Name` vacío → `ValidationException`; `ExistsByNameAsync(name, excludeId: id)` → `ConflictException`; aplica y `UpdateAsync`; devuelve `ToDto`.
- **Delete**: busca (`NotFoundException`); `HasBooksAsync` → `ConflictException("No se puede eliminar una categoría con libros asociados.")`; `DeleteAsync`.
- **List**: normaliza paginación: `CurrentPage < 1` → 1; `PageSize < 1` → 20; `PageSize > 100` → 100. Valida `SortBy`: `null`/vacío o `name` (sin distinguir mayúsculas) válido; otro valor → `ValidationException`. Delega en el repositorio y mapea `Items` a `CategoryDto` conservando `CurrentPage`, `PageSize` (ya normalizados) y `TotalCount`.

### 4.3 Repositorio `Infrastructure/Repositories/CategoryRepository.cs`

Primary constructor con `ApplicationDbContext`.
- `ExistsByNameAsync`: `AnyAsync(c => c.Name.ToLower() == name.ToLower() && (excludeId == null || c.Id != excludeId))`. (Con NOCASE y con in-memory vía `ToLower` el resultado es consistente.)
- `ListAsync`: `AsNoTracking()`; si `filter.Name` no vacío: `Where(c => c.Name.ToLower().Contains(filter.Name.Trim().ToLower()))`; `CountAsync`; orden por `Name` (asc, o desc si `SortDesc`) con desempate por `Id`; `Skip((page-1)*size).Take(size)`.
- `Add/Update/Delete`: `SaveChangesAsync`; captura `DbUpdateException` en `Add/Update` cuando la causa sea violación de unicidad y lanza `ConflictException`.

### 4.4 Manejo de errores HTTP

`Api/Middlewares/ApplicationExceptionHandler.cs` implementa `IExceptionHandler`: `NotFoundException` → 404, `ConflictException` → 409, `ValidationException` → 400, escribiendo `ProblemDetails` (`title`, `status`, `detail`=mensaje). Cualquier otra excepción → no gestionada (500 por defecto). Registro en `Program.cs`: `builder.Services.AddExceptionHandler<ApplicationExceptionHandler>();` (ya existen `AddProblemDetails` y `UseExceptionHandler`).

### 4.5 Validaciones resumidas

| Campo | Regla | Error |
|---|---|---|
| `name` | obligatorio, no solo espacios, 1..80 tras `Trim` | 400 |
| `description` | máx. 500; en blanco → `null` | 400 si excede |
| `name` | único sin distinguir mayúsculas (excluyendo la propia al actualizar) | 409 |
| `sortBy` | `name` o vacío | 400 |
| `pageSize` | >100 se recorta a 100 | sin error |

Caso especial: `PUT` con el mismo nombre de la propia categoría (incluso con otras mayúsculas) es válido.

### 4.6 Registro DI

- `Application/Extensions/ServiceCollectionExtensions.AddApplication`: `AddScoped<ICategoryService, CategoryService>()`.
- `Infrastructure/Extensions/ServiceCollectionExtensions.AddInfrastructure`: `AddScoped<ICategoryRepository, CategoryRepository>()`, `AddScoped<ICategoryDeletionGuard, NoBooksCategoryDeletionGuard>()`.

---

## 5. Datos de seed y ejemplos

Sin seed en la aplicación. Datos de Arrange para tests (nombre → descripción):

| Name | Description |
|---|---|
| `Ciencia ficción` | `Novelas de anticipación` |
| `Ciencias` | `null` |
| `Historia` | `Ensayo histórico` |
| `Novela negra` | `null` |
| `Poesía` | `Verso` |

Ilustran: filtro `"ci"` → `Ciencia ficción`, `Ciencias` (insensible a mayúsculas: `"CI"` igual); `"zzz"` → vacío; orden `name` asc: Ciencia ficción, Ciencias, Historia, Novela negra, Poesía; paginación `pageSize=2`: 3 páginas (2, 2, 1); `pageSize=500` → `PageSize` 100 en la respuesta.

---

## 6. Tests

MSTest + FluentAssertions + Moq, patrón AAA, nombres `Metodo_Escenario_Resultado`. Ubicación en la sección 10.

**CategoryServiceTests** (mocks de `ICategoryRepository` e `ICategoryDeletionGuard`):
- Constructor con dependencias nulas → `ArgumentNullException` (si se usan campos explícitos; con primary constructor, verificar con `ArgumentNullException.ThrowIfNull`).
- Create: éxito (devuelve DTO con `Id` no vacío, `AddAsync` llamado una vez); nombre con espacios se recorta; descripción en blanco → `null`; nombre vacío → `ValidationException`; duplicado → `ConflictException` y `AddAsync` no llamado.
- Get: existente → DTO; inexistente → `NotFoundException`.
- Update: éxito; inexistente → `NotFoundException`; nombre usado por otra → `ConflictException`; mismo nombre propio permitido (se llama a `ExistsByNameAsync` con `excludeId = id`).
- Delete: éxito (`DeleteAsync` llamado); inexistente → `NotFoundException`; con libros (guard devuelve `true`) → `ConflictException` y `DeleteAsync` no llamado.
- List: normalización (`currentPage=0` → 1, `pageSize=0` → 20, `pageSize=500` → 100); `sortBy="price"` → `ValidationException`; `sortBy="NAME"` válido; mapeo de `Items` y metadatos.

**CategoryRepositoryTests** (EF in-memory, base única por test con `Guid.NewGuid().ToString()`):
- `ListAsync`: filtro contiene sin distinguir mayúsculas; sin filtro devuelve todo; orden asc y desc por `name`; paginación (página 2 de `pageSize=2` devuelve el 3.º y 4.º, `TotalCount=5`, `TotalPages=3`); página fuera de rango → `Items` vacío con `TotalCount` correcto; base vacía → vacío y `TotalPages=0`.
- `ExistsByNameAsync`: coincidencia con otras mayúsculas → `true`; con `excludeId` del propio → `false`; inexistente → `false`.
- `Add/Update/Delete` persisten y se leen de vuelta.

**CategoryMappingsTests**: `ToDto`, `ToEntity` (no asigna `Id`), `ApplyTo`.

**CategoriesControllerTests** (mock de `ICategoryService`, llamada directa al controller):
- `CreateCategory` → `CreatedAtActionResult` con `StatusCode 201`, `ActionName = GetCategory`, `RouteValues["id"]`, valor `CategoryDto`.
- `GetCategory` → `OkObjectResult` 200 con DTO.
- `UpdateCategory` → 200 con DTO.
- `DeleteCategory` → `NoContentResult` 204.
- `ListCategories` → 200 con `PagedResult<CategoryDto>` (verifica `Items`, `CurrentPage`, `PageSize`, `TotalCount`) y que pasa filtro `null` como `new CategoryFilter()`.

**ApplicationExceptionHandlerTests**: `NotFoundException` → 404, `ConflictException` → 409, `ValidationException` → 400, otra excepción → `TryHandleAsync` devuelve `false`; el cuerpo es `ProblemDetails` con `status` y `detail`.

(Los códigos HTTP end-to-end `404/409/400` quedan cubiertos por el handler más los tests de servicio; no se añaden tests de integración con `WebApplicationFactory` en esta feature.)

---

## 7. Suposiciones

- **S1**: no hay controladores previos; el patrón REST es el del funcional sección 2. `ActionName` = nombre del método (`CreateCategory`, `GetCategory`, `UpdateCategory`, `DeleteCategory`, `ListCategories`); se aplica con `[ActionName]` explícito.
- **S2**: `PageSize > 100` se recorta a 100; `CurrentPage < 1` → 1; `PageSize < 1` → 20.
- **S3**: `SortBy` válido: `name`; ausente → `name` asc; otro → `400`.
- **S4**: errores de negocio mediante excepciones (`NotFoundException`, `ConflictException`, `ValidationException`) traducidas por un `IExceptionHandler` a ProblemDetails.
- **S5**: validación de DTOs con data annotations + `[ApiController]`; sin FluentValidation.
- **S6**: `Name` se recorta con `Trim()`; `Description` en blanco se guarda `null`.
- **S7**: unicidad por índice único `NOCASE` en SQLite + comprobación previa en servicio; carrera → `DbUpdateException` → `409`.
- **S8**: la regla de "libros asociados" se resuelve con `ICategoryDeletionGuard` (implementación vacía hoy).
- **S9**: sin migración; `EnsureCreated`.
- **S10**: body de `list` opcional (`[FromBody] CategoryFilter? filter = null`); `PaginationCriteria`/`SortingCriteria` por `[FromQuery]`.
- **S11**: DTOs `CategoryDto`, `CreateCategory`, `UpdateCategory` (nombres del funcional, sin sufijo `Dto` salvo el de lectura); sin seed.
- **S12**: sin versionado de API (`Asp.Versioning` no está configurado), por lo que la ruta es `api/categories` sin segmento de versión.
- **S13**: el servicio vive en `Application/Services` y la implementación del guard en `Infrastructure/Services`.

## 8. Dudas abiertas

- ¿Debe la normalización de `Name` conservar acentos como distintos (`Poesia` vs `Poesía`)? Se asume que sí (NOCASE no los equipara).
- ¿Se desea versionado de API en el futuro (`api/v1/...`)? Afectaría a todas las features.
- ¿Soporte de borrado lógico? No contemplado.

## 9. Contratos y formato

- Rutas `api/categories`; JSON `camelCase` (default de ASP.NET Core); `Guid` formato `D`; fechas no aplican en esta feature (UTC ISO 8601 `DateTimeOffset` en el resto).
- Nombres: entidad `Category`, DTOs según 3.5, servicios `CategoryService`, repositorio `CategoryRepository`; XML docs en todo lo público; interfaces con prefijo `I`; `GlobalUsings.cs` por proyecto si hay usings comunes.
- Errores: `ProblemDetails` (sección 2.6). Lecturas con `AsNoTracking()`. I/O siempre `async`.

---

## 10. Apéndice — archivos

| Capa | Ruta | Acción |
|---|---|---|
| Domain | `src/Domain/Entities/Category.cs` | Nuevo |
| Domain | `src/Domain/Constants/CategoryConstants.cs` | Nuevo |
| Domain | `src/Domain/Filters/Categories/CategoryFilter.cs` | Nuevo |
| Application | `src/Application/Models/Categories/CategoryDto.cs` | Nuevo |
| Application | `src/Application/Models/Categories/CreateCategory.cs` | Nuevo |
| Application | `src/Application/Models/Categories/UpdateCategory.cs` | Nuevo |
| Application | `src/Application/Mappings/CategoryMappings.cs` | Nuevo |
| Application | `src/Application/Exceptions/NotFoundException.cs` | Nuevo |
| Application | `src/Application/Exceptions/ConflictException.cs` | Nuevo |
| Application | `src/Application/Exceptions/ValidationException.cs` | Nuevo |
| Application | `src/Application/Interfaces/ICategoryRepository.cs` | Nuevo |
| Application | `src/Application/Interfaces/ICategoryService.cs` | Nuevo |
| Application | `src/Application/Interfaces/ICategoryDeletionGuard.cs` | Nuevo |
| Application | `src/Application/Services/CategoryService.cs` | Nuevo |
| Application | `src/Application/Extensions/ServiceCollectionExtensions.cs` | Modificar |
| Infrastructure | `src/Infrastructure/Contexts/ApplicationDbContext.cs` | Modificar |
| Infrastructure | `src/Infrastructure/Contexts/Configurations/CategoryConfiguration.cs` | Nuevo |
| Infrastructure | `src/Infrastructure/Repositories/CategoryRepository.cs` | Nuevo |
| Infrastructure | `src/Infrastructure/Services/NoBooksCategoryDeletionGuard.cs` | Nuevo |
| Infrastructure | `src/Infrastructure/Extensions/ServiceCollectionExtensions.cs` | Modificar |
| Api | `src/Api/Controllers/CategoriesController.cs` | Nuevo |
| Api | `src/Api/Middlewares/ApplicationExceptionHandler.cs` | Nuevo |
| Api | `src/Api/Program.cs` | Modificar |
| Tests | `tests/UnitTests/Application/CategoryServiceTests.cs` | Nuevo |
| Tests | `tests/UnitTests/Application/CategoryMappingsTests.cs` | Nuevo |
| Tests | `tests/UnitTests/Infrastructure/CategoryRepositoryTests.cs` | Nuevo |
| Tests | `tests/UnitTests/Api/CategoriesControllerTests.cs` | Nuevo |
| Tests | `tests/UnitTests/Api/ApplicationExceptionHandlerTests.cs` | Nuevo |

Dependencias de paquetes a verificar al implementar: `Microsoft.EntityFrameworkCore.InMemory` en `tests/UnitTests`; referencias de proyecto del test a Domain, Application, Infrastructure y Api.

---

## 11. Validación cruzada contra el código real

| # | Punto | Estado | Detalle |
|---|---|---|---|
| 1 | Namespaces filtros/DTOs | ✅ | Convención real `Domain.<Carpeta>` (`Domain.Filters.Common`) → `Domain.Filters.Categories`; `Application.Models.Categories` sigue la carpeta |
| 2 | Paginación y ordenación | ✅ | `CurrentPage`, `PageSize` (20), `SortBy`, `SortDesc` coinciden |
| 3 | `PagedResult` | ✅ | JSON con `items`, `currentPage`, `pageSize`, `totalCount`, `totalPages` |
| 4 | Patrón de controller | ✅ (S1) | No hay controllers existentes; patrón del funcional documentado como suposición |
| 5 | Patrón de servicio | ✅ (S1) | No hay servicios existentes; patrón de `docs/arquitectura-aplicacion.md` |
| 6 | Mapping | ✅ (S1) | No hay mappings existentes; extensiones estáticas en `Application/Mappings` |
| 7 | Tests | ✅ | AAA, MSTest + FluentAssertions como `PagedResultTests`; namespace `UnitTests.<Carpeta>` |
| 8 | Repositorio | ✅ (S1) | No existe repositorio previo; ubicación y `DbSet`/configuración según `ApplicationDbContext` |
