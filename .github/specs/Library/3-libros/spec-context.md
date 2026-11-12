# Contexto — 3-libros

## Sección del funcional a cubrir

`.github/specs/_shared/functional.md`: secciones **2**, **3** (entidad Book) y **4.3** (Libros).

## Specs previas

- `Library/1-categorias` y `Library/2-autores` (ya implementadas): replicar el patrón y **completar** las reglas que quedaron preparadas
  ("no eliminar autor/categoría con libros asociados").

## Restricciones de alcance

- Solo `Book` y sus endpoints (crear, obtener con detalle, actualizar, eliminar, listar con filtros).
- Listado con proyección (`Expression<Func<Book, BookListItem>>`) que incluya nombre de autor y categoría sin N+1.
- `AvailableCopies` solo se modifica aquí al crear/actualizar `TotalCopies`; los préstamos (`4-prestamos`) lo gestionan después.
- Incluir tests de las reglas de ISBN único, existencia de autor/categoría y límite inferior de `TotalCopies`.
