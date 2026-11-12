---
priority: high
---

# Arquitectura de la aplicación (Clean Architecture)

> Documento **starter**: base fiel al repo real, a refinar por el equipo.
> El backend sigue Clean Architecture con 4 proyectos en `src/`.

## Capas y responsabilidades

El solution (`<NombreSolucion>.sln`) tiene 4 proyectos en `src/`:

| Capa | Proyecto | Responsabilidad |
|------|----------|-----------------|
| **Domain** | `src/Domain` | Núcleo del dominio: entidades (`Entities/`), constantes, filtros, paginación. Sin dependencias de infraestructura ni de frameworks web. |
| **Application** | `src/Application` | Casos de uso y lógica de aplicación: interfaces (`Interfaces/`), modelos/DTOs (`Models/`), mapeos (`Mappings/`), proyecciones (`Projections/`), helpers, configuración, recursos. |
| **Infrastructure** | `src/Infrastructure` | Implementaciones técnicas: `DbContext` (`Contexts/`), repositorios (`Repositories/`), servicios externos (`ExternalServices/`), migraciones EF Core (`Migrations/`), integraciones externas. |
| **Api** | `src/Api` | Capa de presentación HTTP: controladores (`Controllers/`), middlewares, filtros, atributos, versionado (`ApiVersioning.cs`), `Program.cs`, arranque y DI. |

## Regla de dependencias (HARD RULE)

La dirección de dependencias es **hacia adentro**. Ninguna capa interior puede depender de una exterior:

```
Api  ─────▶ Application ─────▶ Domain
  │              ▲                ▲
  └────▶ Infrastructure ─────────┘
```

- **Domain** no referencia a nadie. Es puro C#/.NET (sin EF Core, sin ASP.NET, sin paquetes de infraestructura).
- **Application** referencia solo a **Domain**. Define interfaces (`Interfaces/`) que Infrastructure implementa (inversión de dependencias).
- **Infrastructure** referencia a **Application** y **Domain**. Aquí viven `DbContext`, repositorios y servicios externos.
- **Api** referencia a todas y compone la aplicación (registro de servicios, pipeline HTTP).

**Violación típica a evitar:** meter lógica de EF Core, HTTP o Identity en `Domain`, o referenciar `Infrastructure` desde `Application`. Si necesitas una capacidad técnica desde Application, decláralas como **interfaz** en `Application/Interfaces` e impleméntala en `Infrastructure`.

## Dónde va cada cosa

| Necesito añadir… | Va en… |
|------------------|--------|
| Una entidad de dominio | `src/Domain/Entities` |
| Un DTO / modelo de request-response | `src/Application/Models` |
| Un mapeo entidad↔DTO | `src/Application/Mappings` |
| Una proyección de consulta | `src/Application/Projections` |
| Un contrato de servicio (interfaz) | `src/Application/Interfaces` |
| Un repositorio (implementación) | `src/Infrastructure/Repositories` |
| Configuración de `DbContext` / entidad EF | `src/Infrastructure/Contexts` |
| Un servicio externo (Graph, HTTP) | `src/Infrastructure/ExternalServices` |
| Un endpoint / controlador | `src/Api/Controllers` |
| Un middleware / filtro / atributo | `src/Api/{Middlewares,Filters,Attributes}` |

## Flujo típico de una request

1. `Api/Controllers` recibe la request (versionada vía `Asp.Versioning`).
2. Invoca una interfaz de **Application** (caso de uso).
3. La implementación en **Application/Infrastructure** usa repositorios (`Infrastructure/Repositories`) sobre el `DbContext` (`Infrastructure/Contexts`).
4. Se devuelve un DTO/proyección de **Application/Models**, nunca la entidad de dominio cruda al exterior si hay contrato definido.
5. Errores → `Hellang.Middleware.ProblemDetails` (RFC 7807).
