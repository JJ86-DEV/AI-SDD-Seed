using Application.Interfaces;

namespace Infrastructure.Services;

/// <summary>
/// Implementación provisional: aún no existen libros. 3-libros la sustituye por una que consulte Books.
/// </summary>
public class NoBooksCategoryDeletionGuard : ICategoryDeletionGuard
{
    /// <inheritdoc />
    public Task<bool> HasBooksAsync(Guid categoryId, CancellationToken ct) => Task.FromResult(false);
}
