using Application.Models.Categories;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;

namespace Application.Interfaces;

/// <summary>
/// Casos de uso de categorías.
/// </summary>
public interface ICategoryService
{
    /// <summary>Crea una categoría.</summary>
    Task<CategoryDto> CreateAsync(CreateCategory model, CancellationToken ct);

    /// <summary>Obtiene una categoría por id.</summary>
    Task<CategoryDto> GetAsync(Guid id, CancellationToken ct);

    /// <summary>Actualiza una categoría.</summary>
    Task<CategoryDto> UpdateAsync(Guid id, UpdateCategory model, CancellationToken ct);

    /// <summary>Elimina una categoría.</summary>
    Task DeleteAsync(Guid id, CancellationToken ct);

    /// <summary>Lista categorías paginadas.</summary>
    Task<PagedResult<CategoryDto>> ListAsync(CategoryFilter filter, PaginationCriteria paging, SortingCriteria sorting, CancellationToken ct);
}
