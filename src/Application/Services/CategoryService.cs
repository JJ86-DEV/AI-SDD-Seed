using Application.Exceptions;
using Application.Interfaces;
using Application.Mappings;
using Application.Models.Categories;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;

namespace Application.Services;

/// <summary>
/// Implementación de los casos de uso de categorías.
/// </summary>
public class CategoryService(ICategoryRepository repository, ICategoryDeletionGuard deletionGuard) : ICategoryService
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private readonly ICategoryRepository _repository = repository ?? throw new ArgumentNullException(nameof(repository));
    private readonly ICategoryDeletionGuard _deletionGuard = deletionGuard ?? throw new ArgumentNullException(nameof(deletionGuard));

    /// <inheritdoc />
    public async Task<CategoryDto> CreateAsync(CreateCategory model, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(model);
        var (name, description) = Normalize(model.Name, model.Description);

        if (await _repository.ExistsByNameAsync(name, null, ct).ConfigureAwait(false))
        {
            throw new ConflictException($"Ya existe una categoría con el nombre '{name}'.");
        }

        var entity = model.ToEntity();
        entity.Id = Guid.NewGuid();
        entity.Name = name;
        entity.Description = description;

        await _repository.AddAsync(entity, ct).ConfigureAwait(false);
        return entity.ToDto();
    }

    /// <inheritdoc />
    public async Task<CategoryDto> GetAsync(Guid id, CancellationToken ct)
    {
        var entity = await _repository.GetByIdAsync(id, ct).ConfigureAwait(false)
            ?? throw new NotFoundException($"No existe la categoría '{id}'.");
        return entity.ToDto();
    }

    /// <inheritdoc />
    public async Task<CategoryDto> UpdateAsync(Guid id, UpdateCategory model, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(model);
        var entity = await _repository.GetByIdAsync(id, ct).ConfigureAwait(false)
            ?? throw new NotFoundException($"No existe la categoría '{id}'.");

        var (name, description) = Normalize(model.Name, model.Description);

        if (await _repository.ExistsByNameAsync(name, id, ct).ConfigureAwait(false))
        {
            throw new ConflictException($"Ya existe una categoría con el nombre '{name}'.");
        }

        new UpdateCategory { Name = name, Description = description }.ApplyTo(entity);
        await _repository.UpdateAsync(entity, ct).ConfigureAwait(false);
        return entity.ToDto();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var entity = await _repository.GetByIdAsync(id, ct).ConfigureAwait(false)
            ?? throw new NotFoundException($"No existe la categoría '{id}'.");

        if (await _deletionGuard.HasBooksAsync(id, ct).ConfigureAwait(false))
        {
            throw new ConflictException("No se puede eliminar una categoría con libros asociados.");
        }

        await _repository.DeleteAsync(entity, ct).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<PagedResult<CategoryDto>> ListAsync(
        CategoryFilter filter, PaginationCriteria paging, SortingCriteria sorting, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(filter);
        ArgumentNullException.ThrowIfNull(paging);
        ArgumentNullException.ThrowIfNull(sorting);

        if (!string.IsNullOrWhiteSpace(sorting.SortBy)
            && !string.Equals(sorting.SortBy.Trim(), "name", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException($"Campo de ordenación no soportado: '{sorting.SortBy}'.");
        }

        var normalized = new PaginationCriteria
        {
            CurrentPage = paging.CurrentPage < 1 ? 1 : paging.CurrentPage,
            PageSize = paging.PageSize < 1 ? DefaultPageSize : Math.Min(paging.PageSize, MaxPageSize),
        };

        var result = await _repository.ListAsync(filter, normalized, sorting, ct).ConfigureAwait(false);

        return new PagedResult<CategoryDto>
        {
            Items = result.Items.Select(c => c.ToDto()).ToList(),
            CurrentPage = normalized.CurrentPage,
            PageSize = normalized.PageSize,
            TotalCount = result.TotalCount,
        };
    }

    private static (string Name, string? Description) Normalize(string? name, string? description)
    {
        var trimmedName = name?.Trim() ?? string.Empty;
        if (trimmedName.Length == 0)
        {
            throw new ValidationException("El nombre es obligatorio.");
        }

        var trimmedDescription = description?.Trim();
        return (trimmedName, string.IsNullOrEmpty(trimmedDescription) ? null : trimmedDescription);
    }
}
