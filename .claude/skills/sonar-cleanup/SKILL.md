---
name: sonar-cleanup
description: Ejecuta SonarLint (SonarQube for IDE) sobre los ficheros pendientes de commit y corrige sus avisos, aplicando las excepciones del proyecto. Usar cuando el usuario pida pasar, limpiar o revisar Sonar, o pegue avisos de SonarQube.
---

# Sonar cleanup (Claude Code)

Versión para Claude Code del agente de Copilot [`.github/agents/sonar-cleanup.agent.md`](../../../.github/agents/sonar-cleanup.agent.md).
**Las Excepciones, Correcciones habituales y el formato del resumen están allí: leerlo antes de empezar.** No duplicar reglas aquí.

Correr en la sesión principal (no en subagente): los diagnósticos de VS Code llegan a esta sesión.

## Cómo se lanza el análisis

SonarLint solo analiza ficheros **editados**. Abrirlos con `code -r` no lo dispara. Claude lo lanza con un **toque**: editar y revertir.

Por cada fichero del ámbito:

1. `Edit`: añadir una línea `// sonar-probe` (o `<!-- sonar-probe -->` en HTML) tras la primera línea.
2. `Edit`: quitarla (contenido idéntico al original).
3. `mcp__claude-vscode__getDiagnostics` con su URI `file:///c:/...` → avisos con `source: "sonarqube"` (`csharpsquid:Sxxxx`, `Web:Sxxxx`…). Ignorar cualquier aviso sobre la línea de la sonda.

Al terminar: `git diff --stat` de los ficheros tocados debe ser el mismo que al empezar. Si no, revertir la sonda antes de nada.

No tocar ficheros con cambios sin guardar en el editor (preguntar).

En ficheros que Claude corrige, los avisos también llegan solos tras cada `Edit` (bloque `ide_diagnostics`). Un listado pegado de SonarQube se usa tal cual.

## Flujo

1. **Ámbito**: ficheros que indique el usuario; si no, los pendientes de commit (`git diff --name-only HEAD`, `git ls-files --others --exclude-standard`). Quitar los de Excepciones con "Todas" las reglas y los que Sonar no analiza (`.md`, `.json`…).
2. **Analizar** cada uno con el toque (ver arriba).
3. **Clasificar** cada aviso según `sonar-cleanup.agent.md`: 🟢 corregir, ⚪ ignorado por regla, 🟡 dudoso → preguntar.
4. **Corregir** 🟢. Tras cada `Edit`, mirar el `ide_diagnostics` devuelto: aviso nuevo provocado por el cambio → revertir y pasar a 🟡.
5. **Verificar**: `dotnet build --configuration Release` y tests (`tests/UnitTests/UnitTests.csproj`) si se tocó C#.
6. **Resumen** con la tabla del agente. Sin commit salvo que lo pida.

Prohibido tocar el scope de SonarQube ni la configuración de la extensión (`.vscode/settings.json`, exclusiones de SonarLint).
