# Funcional — Catálogo de biblioteca (ejemplo de la semilla)

> Documento funcional **de ejemplo** para probar el flujo SDD completo
> (`spec-generator` → `spec-implementer` → `code-review`). Sustituir por el
> funcional real al instanciar la semilla.

## 1. Alcance

API backend para gestionar el catálogo de una biblioteca pequeña: autores, categorías,
libros y préstamos. No hay interfaz de usuario ni autenticación en esta versión.

Fuera de alcance: usuarios/socios, multas, reservas, importación masiva, autenticación y autorización.

## 2. Convenciones transversales

Aplican a todas las features. Como el proyecto aún no tiene controladores, **estas convenciones
son las que definen el patrón**: la primera feature implementada (`1-categorias`) las fija en código
y el resto las replica.

| Tema | Convención |
|------|-----------|
| Rutas | Prefijo `api/<recurso-en-plural-minúsculas>` (p. ej. `api/categories`) |
| Identificadores | `Guid`, serializados en formato `D` |
| Fechas | UTC, ISO 8601 (`DateTimeOffset`) |
| JSON | `camelCase` |
| Listados | `POST api/<recurso>/list`, filtros en body, `PaginationCriteria` y `SortingCriteria` en query, respuesta `PagedResult<T>` |
| Obtener por id | `GET api/<recurso>/{id}` → `200` o `404` |
| Crear | `POST api/<recurso>` con DTO `CreateX` → `201 Created` + DTO creado (cabecera `Location`) |
| Actualizar | `PUT api/<recurso>/{id}` con DTO `UpdateX` → `200` + DTO actualizado, o `404` |
| Eliminar | `DELETE api/<recurso>/{id}` → `204`, o `404`; `409` si tiene dependencias |
| Errores | `ProblemDetails` (RFC 7807): `400` validación, `404` no encontrado, `409` conflicto de negocio |
| Persistencia | EF Core + SQLite en local; Fluent API; sin migraciones en la demo (`EnsureCreated`) |
| Paginación | `CurrentPage` desde 1, `PageSize` por defecto 20, máximo 100 |
| Tests | MSTest + FluentAssertions + Moq; EF in-memory para repositorios |

## 3. Entidades

### Author (autor)

| Campo | Tipo | Reglas |
|-------|------|--------|
| Id | Guid | PK |
| Name | string | Obligatorio, máx. 150 |
| Country | string? | Opcional, máx. 80 |
| BirthYear | int? | Opcional, entre 1000 y el año actual |

### Category (categoría)

| Campo | Tipo | Reglas |
|-------|------|--------|
| Id | Guid | PK |
| Name | string | Obligatorio, máx. 80, **único** (sin distinguir mayúsculas) |
| Description | string? | Opcional, máx. 500 |

### Book (libro)

| Campo | Tipo | Reglas |
|-------|------|--------|
| Id | Guid | PK |
| Title | string | Obligatorio, máx. 250 |
| Isbn | string | Obligatorio, 13 dígitos, **único** |
| PublishedYear | int | Entre 1000 y el año actual |
| AuthorId | Guid | FK a Author, obligatorio |
| CategoryId | Guid | FK a Category, obligatorio |
| TotalCopies | int | ≥ 0 |
| AvailableCopies | int | Entre 0 y `TotalCopies`; se gestiona con los préstamos |

Relaciones: un autor tiene muchos libros; una categoría tiene muchos libros.

### Loan (préstamo)

| Campo | Tipo | Reglas |
|-------|------|--------|
| Id | Guid | PK |
| BookId | Guid | FK a Book, obligatorio |
| BorrowerName | string | Obligatorio, máx. 150 (no hay entidad de socio) |
| LoanedAt | DateTimeOffset | UTC, lo asigna el sistema |
| DueAt | DateTimeOffset | `LoanedAt` + 14 días |
| ReturnedAt | DateTimeOffset? | Nulo mientras esté activo |

## 4. Funcionalidades

### 4.1 Categorías (feature piloto)
- Crear, obtener, actualizar, eliminar y listar categorías.
- Listado con filtro por nombre (contiene, sin distinguir mayúsculas), ordenable por `name`.
- No se puede eliminar una categoría con libros asociados (`409`).
- No se admiten nombres duplicados (`409`).

### 4.2 Autores
- Crear, obtener, actualizar, eliminar y listar autores.
- Listado con filtros por nombre (contiene) y país (igual), ordenable por `name` y `birthYear`.
- No se puede eliminar un autor con libros asociados (`409`).

### 4.3 Libros
- Crear, obtener, actualizar y eliminar libros. Al crear, `AvailableCopies = TotalCopies`.
- Validar que autor y categoría existen (`400` si no).
- ISBN único (`409` si ya existe).
- Al actualizar `TotalCopies` no puede quedar por debajo de las copias prestadas (`409`).
- No se puede eliminar un libro con préstamos activos (`409`).
- Listado con filtros: título (contiene), autor, categoría, año desde/hasta y `soloDisponibles`
  (`AvailableCopies > 0`). Ordenable por `title`, `publishedYear`. Cada elemento incluye
  el nombre del autor y de la categoría.
- El detalle de un libro incluye autor, categoría y copias disponibles.

### 4.4 Préstamos
- **Prestar** un libro: `POST api/loans` con `BookId` y `BorrowerName`.
  - `404` si el libro no existe; `409` si no hay copias disponibles.
  - Descuenta una copia disponible y fija `LoanedAt`/`DueAt`.
- **Devolver**: `POST api/loans/{id}/return`.
  - `404` si no existe; `409` si ya estaba devuelto.
  - Fija `ReturnedAt` y suma una copia disponible.
- **Listar** préstamos: filtros por libro, prestatario (contiene) y estado (`activo`, `devuelto`, `vencido`).
  Es *vencido* el préstamo activo con `DueAt` en el pasado. Ordenable por `loanedAt` y `dueAt`.
- Obtener un préstamo por id.

## 5. Orden de implementación sugerido

1. `Library/1-categorias` — fija el patrón de capas (feature piloto, sin dependencias).
2. `Library/2-autores` — replica el patrón.
3. `Library/3-libros` — relaciones, filtros y proyecciones.
4. `Library/4-prestamos` — reglas de negocio con efectos sobre otra entidad.
