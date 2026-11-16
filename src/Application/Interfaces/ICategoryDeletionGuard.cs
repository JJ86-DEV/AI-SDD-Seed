namespace Application.Interfaces;

/// <summary>
/// Punto de extensión: indica si una categoría tiene libros asociados e impide su borrado.
/// </summary>
public interface ICategoryDeletionGuard
{
    /// <summary>Devuelve true si la categoría tiene libros asociados.</summary>
    Task<bool> HasBooksAsync(Guid categoryId, CancellationToken ct);
}
