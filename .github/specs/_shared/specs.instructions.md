# Instrucciones para la generación de documentos de especificación técnica

---

## Estructura obligatoria de los documentos de specs

1. **Resumen funcional** — qué problema resuelve y tipología (CRUD, listado, etc.).
2. **Endpoints** — por cada uno: método HTTP, ruta relativa, `ActionName`, descripción; parámetros de entrada (tipo, ubicación `FromBody`/`FromQuery`/`FromRoute`, obligatorio/opcional); ejemplo de request; response (tipo, JSON, ejemplo); códigos de respuesta aplicables (200, 201, 204, 400, 401, 404, 500).
3. **Modelo de datos** — entidades (propiedades, tipos CLR, nullability, relaciones), constantes de dominio, configuración Fluent API, nombre de la migración EF Core, relación con DTOs.
4. **Lógica de negocio** — reglas, validaciones, flujo, manejo de errores, casos especiales, delegación a servicios.
5. **Datos de seed y ejemplos** — seed si hace falta, ejemplos JSON, datos de Arrange para tests; suficientes para ilustrar filtros, paginación, ordenación y casos vacíos.
6. **Tests** — casos principales, edge y de error. Validar siempre código HTTP, tipo de respuesta, datos devueltos, orden y paginación.
7. **Suposiciones** — qué se ha asumido por falta de información.
8. **Dudas abiertas** — qué habría que aclarar con negocio.
9. **Contratos y formato** — convenciones de nombres, DTOs, formato de fechas y de errores.
10. **Apéndice** — tabla de archivos a crear/modificar (capa, ruta, Nuevo/Modificar).

---

## Formato y nivel de detalle

Documento técnico en Markdown que combine descripción funcional, contrato de endpoints, comportamiento y casos de prueba implementables.

- Implementable sin consultar el funcional, sin ambigüedades y con ejemplos completos.
- Lenguaje técnico y preciso; evitar expresiones genéricas.

---

## Plan de implementación (`milestones.md`)

Cada spec va acompañada de `milestones.md` en el mismo directorio, con una tabla de hitos.

Columnas obligatorias: `#`, `Hito / Tarea`, `Descripción`, `Tipo` (Entidad, DTO, Interfaz, Servicio, Endpoint, Test, Validación, Modificar, Constante, Mapping, DTO Filtro, Migración, Configuración EF), `Estado` (Pendiente, En progreso, Completado).

```markdown
| # | Hito / Tarea | Descripción | Tipo | Estado |
|---|---|---|---|---|
| 1 | Entidades de dominio | Crear `Foo.cs` en `Domain/Entities/` | Entidad | Pendiente |
| 2 | Servicios | Crear `FooService.cs` en `Application/` | Servicio | Pendiente |
| 3 | Controllers | Crear `FooController.cs` en `Api/Controllers/` | Endpoint | Pendiente |
| 4 | Registro DI | Registrar servicios y repositorios | Modificar | Pendiente |
| 5 | Tests | Tests de mappings y servicios | Test | Pendiente |
| 6 | Validación: `dotnet build` | Compilación sin errores | Validación | Pendiente |
| 7 | Validación: `dotnet test` | Todos los tests en verde | Validación | Pendiente |
```

Cobertura mínima: endpoints, validaciones, tests, casos edge, integración con servicios y todo lo necesario para dar la funcionalidad por completa.

---

## Interacción y resolución de dudas

### ❗ Regla de bloqueo (obligatoria)

**ANTES de generar cualquier contenido**, el agente DEBE:

1. Analizar el funcional e identificar dudas, ambigüedades e información faltante.
2. Formular preguntas claras y concretas en un único bloque.
3. **ESPERAR la respuesta del usuario.**

Si no hay dudas, indicarlo explícitamente: "No se han detectado dudas. Procedo a generar la spec."

Solo se permiten suposiciones si se han formulado las preguntas y el usuario ha respondido que asuma lo que considere (o ha dado respuestas parciales). Toda suposición se documenta en la sección correspondiente. **Nunca asumir sin haber preguntado antes.**

---

## Convenciones del proyecto (PRIORIDAD MÁXIMA)

Estas reglas prevalecen sobre cualquier otra parte del documento. En conflicto, prevalece el **código existente**.

- **No inventar convenciones REST nuevas**: replicar los endpoints, atributos, firmas y formatos de respuesta ya existentes en `src/Api/Controllers`.
- Los controladores solo orquestan: delegan en la capa Application, sin lógica de negocio.
- Para cualquier tipo de endpoint (listado, creación, borrado, obtención por id, búsqueda…) buscar primero uno existente del mismo tipo y replicar estructura, atributos y firma. Si no hay ejemplo, usar el patrón más cercano y documentarlo como suposición.
- Respetar `docs/arquitectura-aplicacion.md` y `docs/convenciones.md`.

Orden de prioridad ante dudas:

1. Código existente
2. Documentación del proyecto (`docs/`)
3. Documento funcional
4. Suposiciones documentadas

---

## Validación y revisión de calidad

Tras generar la spec, hacer una **validación cruzada** contra el código real (el agente `code-review` no aplica a Markdown).

| # | Punto de validación | Qué leer en el proyecto | Qué verificar en la spec |
|---|---|---|---|
| 1 | Namespaces de filtros/DTOs | Un filtro o DTO existente | Que el namespace propuesto siga la convención real |
| 2 | Paginación y ordenación | `Domain/Pagination` y tipos de criterios existentes | Nombres de propiedades y valores por defecto |
| 3 | Estructura de resultados paginados | Tipos de `PagedResult` existentes | Que los ejemplos JSON reflejen las propiedades reales |
| 4 | Patrón de controller | Un controller existente similar | Atributos, firma, ubicación de parámetros y códigos de respuesta |
| 5 | Patrón de servicio | Un servicio existente similar | Que el flujo propuesto sea coherente |
| 6 | Patrón de mapping | Un mapping existente | Convención de nombres y estructura |
| 7 | Patrón de tests | Un test existente | Setup de mocks y estructura AAA |
| 8 | Interfaz de repositorio | Un repositorio existente | Firmas de métodos |

Informe: estado por punto (✅ / ❌), detalle de cada inconsistencia (spec vs código) y acción correctiva. Corregir y repetir hasta que todos estén en ✅.
