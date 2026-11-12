# Instrucciones para la implementación de especificaciones técnicas

---

## Regla principal

La spec es el contrato. Toda decisión de implementación debe estar respaldada por lo escrito en la spec.

Si la spec no cubre una situación concreta, consultar en este orden:

1. Código existente del proyecto (buscar un caso análogo)
2. Documentación del proyecto (`docs/`)
3. Preguntar al usuario antes de asumir

---

## Orden de implementación

Seguir **estrictamente** el orden de hitos de `milestones.md`. No saltar hitos ni implementar uno si el anterior no está completado.

### Agrupación por lotes

**Tabla de lotes de referencia** (ajustar según la spec; omitir los que no apliquen):

| Lote | Hitos | Descripción | Cuándo omitir |
|------|-------|-------------|---------------|
| 1 | Entidades, constantes, filtros | Capa Domain | Si no hay entidades nuevas |
| 2 | DTOs, mappings, proyecciones, interfaces | Capa Application — contratos | Si solo se amplían DTOs existentes |
| 3 | Servicios y validadores | Capa Application — implementación | Nunca |
| 4 | Repositorios, configuración EF, migración | Capa Infrastructure | Si no hay cambios de persistencia |
| 5 | Controllers | Capa Api | Si solo se modifica lógica interna |
| 6 | Registro DI | Transversal | Si no hay tipos nuevos que registrar |
| 7 | Tests | Tests | Nunca |
| 8 | Validación build + tests | Verificación final | Nunca |

> Antes de empezar, determinar qué lotes son necesarios y documentar los omitidos con su motivo.

Dentro de un lote, los archivos independientes pueden crearse en paralelo.

---

## Actualización obligatoria de milestones

Cada vez que se complete un hito:

1. Cambiar el estado en `milestones.md` de `Pendiente` a `Completado` (o `En progreso` si se está trabajando).
2. No marcar `Completado` hasta que el código compile sin errores.

La actualización se hace **durante** la implementación, no al final.

> Al reemplazar texto en `milestones.md`, el texto a sustituir debe incluir **la tabla entera** (cabecera hasta la última fila) para no duplicar contenido.

---

## Convenciones de implementación

Respetar `docs/arquitectura-aplicacion.md` y `docs/convenciones.md`.

### Prioridad ante conflictos

Si la spec contradice el código existente:

1. El código existente prevalece.
2. Documentar la desviación como comentario en el código.
3. Informar al usuario de la inconsistencia.

---

## Verificación continua

Tras cada lote:

```pwsh
dotnet build --no-restore --configuration Release
```

Si falla, corregir antes de avanzar. Tras el último lote de código y los tests:

```pwsh
dotnet test "tests/UnitTests/UnitTests.csproj" --no-build --no-restore --configuration Release
```

---

## Revisión de código obligatoria

**Cuándo:** tras completar todos los hitos y antes de dar la tarea por finalizada.

**Cómo:** invocar el agente `code-review` con los archivos creados o modificados (solo esos).

**Flujo:** implementación → build ✅ → tests ✅ → `code-review`. Si hay problemas, corregir, repetir build + tests + revisión hasta que no haya CRÍTICOS.

**Criterio de aceptación:** `dotnet build` sin errores, `dotnet test` en verde, `code-review` sin CRÍTICOS. Las SUGERENCIAS se documentan pero no bloquean.

---

## Formato de entrega

- Archivos creados y modificados
- Resultado de `dotnet build` y `dotnet test`
- Resumen del code-review
- Estado final de `milestones.md` (todos en `Completado`)

---

## Reglas de seguridad

- No hardcodear secrets ni cadenas de conexión.
- No crear archivos fuera de `src/` y `tests/`.
- No modificar archivos de configuración (`appsettings.json`, `NuGet.config`) salvo que la spec lo indique.
- No ejecutar `dotnet ef migrations` ni acciones destructivas sin confirmación del usuario.
