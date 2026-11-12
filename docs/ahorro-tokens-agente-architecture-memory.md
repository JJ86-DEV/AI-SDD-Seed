# Cómo ahorrar tokens con el agente `architecture-memory`

Guía rápida para el equipo: qué hacer (y qué no) al pedirle cosas a este agente para que gaste el mínimo contexto posible.

## Por qué importa

Un cambio de una palabra llegó a costar 81.500 tokens en una sesión real por no usar cache/grafo. Este agente tiene reglas para evitarlo, pero **el equipo también influye** en cómo se formula la petición.

## Qué hacer

- **Sé específico.** "Cambia el timeout de X a 30s en `RetryPolicy.cs`" gasta muchísimo menos que "revisa la configuración de reintentos". Cuanto más preciso el prompt, menos exploración necesita el agente.
- **Pide cambios quirúrgicos como quirúrgicos.** Si es 1-3 líneas, dilo así ("cambia esta constante", "arregla este typo"). El agente entra en *fast path* (≤3 llamadas a herramientas) en vez del protocolo completo.
- **Reutiliza el hilo/sesión cuando el tema sea similar.** La cache semántica (`memory:semantic-cache`) detecta prompts parecidos y puede saltarse toda la exploración si ya se resolvió algo equivalente antes.
- **Si haces la misma pregunta dos veces, es señal de que algo no se cacheó bien** — repórtalo, no lo repitas esperando que "esta vez sea diferente".

## Qué evitar

- **No pidas "explícame toda la arquitectura" cuando solo necesitas saber quién llama a una función.** Eso dispara exploración amplia del grafo en vez de una consulta puntual.
- **No pegues código completo en el prompt "por si acaso".** El agente ya tiene acceso al grafo de código (`codebase-memory-mcp`) y a la cache de ficheros; pegar código duplica contexto que ya está indexado.
- **No repitas contexto ya dado en el mismo hilo.** Si ya mencionaste el fichero o el problema, no hace falta repetirlo en cada mensaje.
- **No mezcles varias peticiones no relacionadas en un mismo prompt.** Cada tarea nueva dispara sus propios gates de validación; mezclar tareas multiplica el trabajo de análisis.

## Qué hace el agente automáticamente (no depende de ti)

- Usa el **grafo de código** en vez de abrir ficheros `.cs` completos.
- Usa **cache de lectura de ficheros** (no relee lo mismo dos veces en la sesión).
- Usa **cache semántica de prompts** (evita re-razonar peticiones parecidas).
- Aplica **topes duros** de nº de llamadas a herramientas según el tipo de tarea.
- Decide solo si el cambio es "quirúrgico" (rápido) o "arquitectónico" (protocolo completo con justificación) — por defecto asume quirúrgico salvo que detecte señales de decisión de diseño.

## Resumen para el día a día

| Si quieres... | Formúlalo así |
|---|---|
| Un fix puntual | "Cambia X por Y en `Fichero.cs`" |
| Saber quién usa algo | "¿Quién llama a `MetodoX`?" |
| Una decisión de diseño | "Evaluemos migrar/cambiar el patrón de X, contexto: ..." |
| Repetir algo ya resuelto | No lo repitas: referencia el resultado anterior en el mismo hilo |

Cuanto más concreta la petición, menos tokens y menos vueltas necesita el agente para responder bien.
