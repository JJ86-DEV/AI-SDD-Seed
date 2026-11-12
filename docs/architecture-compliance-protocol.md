---
priority: high
---

# Protocolo de cumplimiento arquitectónico (.NET)

> Documento **starter**: define el contrato de comportamiento que el agente
> `Architecture Memory` y sus gates consultan por `## ` sección literal vía
> `memory:lookup`. Los títulos de sección son la clave de despacho de la
> "Tabla de proxy" del agente — no renombrarlos sin actualizar el agente.

## Principios Vinculantes

1. **La verdad está en el código y el corpus.** No inventes APIs, tipos, comportamientos ni convenciones que no estén en el repo o en `docs/`. Si no lo puedes verificar, dilo.
2. **La verificación es proporcional a la tarea.** Un cambio de 1-3 líneas no justifica explorar el sistema entero. Un refactor cross-capa sí exige entender el blast radius.
3. **La regla de dependencias de Clean Architecture es inviolable** (ver `## Dirección de dependencias / layering`).
4. **Fidelidad literal a la instrucción.** Cuanto más concreta es la petición del usuario, menor es tu iniciativa. No amplíes el alcance sin pedirlo.
5. **Stop del usuario prevalece.** "para", "basta", "stop", "ya" → siguiente turno con cero tool calls, solo acknowledgement.

## Comportamientos Prohibidos

- Referenciar `Infrastructure` desde `Application` o `Domain`.
- Meter EF Core, ASP.NET, HTTP o Identity dentro de `Domain`.
- Exponer entidades de dominio crudas por la Api cuando existe un DTO/contrato.
- Editar código `.cs` sin localizar antes el símbolo con el proveedor de code-graph (`codebase-memory-mcp` por defecto).
- Añadir paquetes NuGet o cambiar `TargetFramework` sin que el usuario lo pida.
- Ejecutar comandos destructivos (migraciones sobre BD real, `dotnet ef database drop`, borrados) sin confirmación explícita.
- Saltarse los quality gates (`request-gate` + `compliance-gate`) antes de una mutación.

## Comportamientos Obligatorios

- Antes de tocar código `.cs`: localizar con el proveedor de code-graph (`search_graph` / `get_code_snippet`) y confirmar firma.
- Antes de crear un tipo nuevo: ver `## Ubicación de DTOs/Contracts y pureza del Domain`.
- Async/await en toda I/O (EF Core, HTTP, ficheros). Métodos async devuelven `Task`/`Task<T>`.
- DI por constructor (primary constructor cuando aplique). Registrar servicios con el lifetime correcto.
- XML docs en miembros públicos.
- Tras un cambio: compilar (`dotnet build`) y, si hay tests, ejecutarlos.

## Dirección de dependencias / layering

*(Falla recurrente #1 — consultar antes de cualquier cambio cross-capa.)*

Dirección de dependencias **hacia adentro**: `Api → Application → Domain`, `Infrastructure → Application/Domain`. Reglas duras:

- `Domain` no depende de nada (ni EF Core, ni ASP.NET, ni paquetes de infraestructura).
- `Application` depende solo de `Domain`. Las capacidades técnicas se declaran como **interfaz** en `Application/Interfaces` y se implementan en `Infrastructure`.
- `Infrastructure` implementa las interfaces de `Application` (repositorios, servicios externos, `DbContext`).
- `Api` compone todo (DI en `Program.cs`).

Antes de añadir un `using` o una referencia de proyecto que cruce capas, verifica que respeta esta dirección. Si no, es un **hard stop**: replantea con inversión de dependencias.

## Ubicación de DTOs/Contracts y pureza del Domain

*(Falla recurrente #2 — consultar antes de definir cualquier tipo nuevo.)*

- **Entidades de dominio** → `src/Domain/Entities`. Sin anotaciones de EF/serialización que aten el dominio a infraestructura (preferir Fluent API en `Infrastructure/Contexts`).
- **DTOs / modelos de entrada-salida** → `src/Application/Models`. Nunca en `Domain`, nunca en `Api`.
- **Mapeos entidad↔DTO** → `src/Application/Mappings`. **Proyecciones** de consulta → `src/Application/Projections`.
- **Interfaces / contratos de servicio** → `src/Application/Interfaces` (implementación en `Infrastructure`).
- No dupliques un DTO ya existente: busca primero con `search_graph` / `memory:lookup`.

## PASO 1 CLASIFICACIÓN DE LA TAREA

Clasifica antes de actuar: **cambio quirúrgico** (edición puntual, fix 1-3 líneas, pregunta factual → respuesta directa) vs **tarea arquitectónica** (diseño cross-capa, nuevo patrón, refactor multi-archivo → formato completo). Si dudas, asume quirúrgico.

## PASO 2 EXPLORACIÓN LIGERA

Usa el proveedor de code-graph (`codebase-memory-mcp`) para entender relaciones sin abrir cada fichero: `search_graph` para localizar, `trace_path` para call chains, `get_architecture` para estructura. Tope: exploración proporcional. No leas `.cs` con `read_file` si el grafo ya responde.

## PASO 3 VALIDACIÓN PRE-EDICIÓN

Antes de mutar:

1. Confirmar el símbolo y su firma exacta (`get_code_snippet <qualified_name>`).
2. Ver quién lo llama si es público (`trace_path mode=calls`) — blast radius.
3. Verificar que el cambio respeta `## Dirección de dependencias / layering`.
4. Verificar ubicación correcta de tipos nuevos (`## Ubicación de DTOs/Contracts y pureza del Domain`).
5. Tener identificados los bytes exactos a cambiar.

## PASO 4 PROPUESTA PRE-CAMBIO

Para tareas no triviales, resume al usuario en 1-3 líneas: qué archivo, qué cambio, qué riesgo aguas abajo. No para cambios quirúrgicos con bytes exactos evidentes.

## PASO 4.5 VALIDACIÓN CODE REVIEWER

Tras aprobación (o en fast path como sanity check final conciso), pasar el cambio por revisión: ¿respeta layering? ¿async correcto? ¿DI y lifetime correctos? ¿nombres y XML docs? ¿tests cubren éxito y fallo?

## PASO 5 EJECUCIÓN

Con plan validado por los gates: ejecución mecánica. `search_graph`/`get_code_snippet` para localizar → edición con bytes exactos. Tope duro fast path: ≤3 calls. No re-leer ficheros ya cubiertos.

## PASO 6 VALIDACIÓN POST-CAMBIO

- `dotnet build` de la solución o del proyecto afectado.
- Si hay tests: `dotnet test` (MSTest + FluentAssertions + Moq).
- Si tocaste el modelo EF: verificar si requiere migración (`dotnet ef migrations add <Nombre>`), sin aplicarla a BD real sin confirmación.

## PASO 7 REPORTE FINAL

Reporte conciso: archivos tocados, resultado de `build`/`test`, y (si aplica) tabla de cumplimiento de las reglas duras. Sin relleno.

## PASO 8 PROHIBICIONES DOCUMENTADAS

Antipatterns recurrentes a evitar (además de `## Comportamientos Prohibidos`):

- Leer el mismo fichero 2+ veces.
- `read_file` sobre `.cs` cuando el grafo ya dio path+línea.
- N+1 en EF Core (usar `Include`/proyección).
- Consultas sin `AsNoTracking()` en lecturas.
- Bloquear async con `.Result`/`.Wait()`.
- Duplicar un DTO/interfaz existente por no buscar antes.

## PASO 9 ABORTO TOTAL

Para inmediatamente si: el usuario dice "para"; un cambio requiere violar el layering; una operación es destructiva sobre BD/datos reales sin confirmación; una herramienta externa falla y el dato depende de ella (no inventes el resultado).

## PASO 10 CHECKLIST EJECUTIVO

Antes de cerrar: ☐ gates OK en ESTA tarea ☐ layering respetado ☐ tipos en su capa ☐ async correcto ☐ `build` verde ☐ tests (si existen) verdes ☐ reporte final entregado.
