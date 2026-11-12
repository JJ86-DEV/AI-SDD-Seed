---
applyTo: '**'
---

# Instrucciones para compilación y ejecución de tests (.NET 10)

Antes de hacer commit o crear un Pull Request, verifica siempre que el código compila correctamente y que todos los tests pasan.
Ejecuta los pasos en el orden indicado desde la raíz del repositorio.

---

## 1. Limpiar artefactos anteriores

```pwsh
dotnet clean
```

- Elimina los binarios y objetos generados en compilaciones previas.
- Garantiza que los pasos siguientes parten de un estado limpio.

---

## 2. Restaurar paquetes NuGet

```pwsh
dotnet restore
```

- Descarga y restaura todas las dependencias declaradas en los `.csproj`.
- Si el repositorio incorpora un `NuGet.config` con feeds privados, se usa automáticamente.

---

## 3. Compilar la solución

```pwsh
dotnet build --no-restore --configuration Release
```

- Compila todos los proyectos de la solución (`src/` y `tests/`).
- **Si hay errores de compilación, corrígelos antes de continuar.**
- Los *warnings* de Sonar / nullability deben resolverse igualmente (el proyecto tiene `TreatWarningsAsErrors = true` en las capas `Application` e `Infrastructure`).

---

## 4. Ejecutar los tests unitarios

```pwsh
dotnet test "tests/UnitTests/UnitTests.csproj" --no-build --no-restore --configuration Release
```

- Ejecuta todos los tests del proyecto `UnitTests`.
- **Todos los tests deben estar en verde (passed) antes de hacer commit.**
- Si algún test falla, analiza el mensaje de error, corrige el código y repite desde el paso 3.

---

## Comprobación rápida (sin limpiar)

Cuando solo hayas modificado código fuente y quieras iterar rápidamente, puedes combinar build + test en un único comando:

```pwsh
dotnet build --configuration Release; dotnet test "tests/UnitTests/UnitTests.csproj" --no-build --no-restore --configuration Release
```

---

## Referencia de flags útiles

| Flag | Descripción |
|---|---|
| `--no-restore` | Omite la restauración (usa la caché existente) |
| `--no-build` | Omite la compilación (usa binarios ya generados) |
| `--configuration Release` | Compila en modo Release (igual que en el pipeline CI) |
| `--logger "trx;LogFileName=..."` | Genera un informe de resultados en formato TRX |
| `/p:CollectCoverage=true` | Activa la cobertura de código con Coverlet |

---

## Criterio de aceptación

| Comprobación | Resultado esperado |
|---|---|
| `dotnet build` | `Build succeeded` sin errores ni warnings bloqueantes |
| `dotnet test` | `Passed!` — todos los tests en verde |
