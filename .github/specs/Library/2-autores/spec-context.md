# Contexto — 2-autores

## Sección del funcional a cubrir

`.github/specs/_shared/functional.md`: secciones **2**, **3** (entidad Author) y **4.2** (Autores).

## Specs previas

- `Library/1-categorias` (ya implementada): replicar su estructura de capas, controlador, DTOs, mappings, servicio, repositorio y tests.

## Restricciones de alcance

- Solo `Author` y sus endpoints (crear, obtener, actualizar, eliminar, listar con filtros por nombre y país).
- Igual que en categorías, la regla "no eliminar con libros asociados" queda preparada hasta que exista `Book`.
- No duplicar la infraestructura común ya creada en `1-categorias`: solo ampliar.
