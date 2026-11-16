using Domain.Entities;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;

namespace Application.Interfaces;

/// <summary>
/// Acceso a datos de categorías.
/// </summary>
public interface ICategoryRepository
{
    /// <summary>Obtiene una categoría con tracking.</summary>
    Task<Category?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Indica si existe una categoría con ese nombre (sin distinguir mayúsculas).</summary>
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);

    /// <summary>Lista categorías paginadas (sin tracking).</summary>
    Task<PagedResult<Category>> ListAsync(CategoryFilter filter, PaginationCriteria paging, SortingCriteria sorting, CancellationToken ct);

    /// <summary>Añade y guarda.</summary>
    Task AddAsync(Category category, CancellationToken ct);

    /// <summary>Actualiza y guarda.</summary>
    Task UpdateAsync(Category category, CancellationToken ct);

    /// <summary>Elimina y guarda.</summary>
    Task DeleteAsync(Category category, CancellationToken ct);
}
