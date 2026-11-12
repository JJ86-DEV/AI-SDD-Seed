# Contexto — 4-prestamos

## Sección del funcional a cubrir

`.github/specs/_shared/functional.md`: secciones **2**, **3** (entidad Loan) y **4.4** (Préstamos).

## Specs previas

- `Library/3-libros` (ya implementada): `Book` y su campo `AvailableCopies`.
- Replicar el patrón de capas de las features anteriores.

## Restricciones de alcance

- Solo `Loan` y sus endpoints: prestar, devolver, obtener por id y listar con filtros (libro, prestatario, estado).
- Prestar y devolver deben modificar `Book.AvailableCopies` **en la misma transacción** que el préstamo.
- El estado `vencido` se calcula en consulta (no se persiste) y debe ser traducible por EF Core.
- Completar la regla de `3-libros` "no eliminar un libro con préstamos activos".
- Fuera de alcance: socios, multas, renovaciones y reservas.
