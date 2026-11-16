using Application.Exceptions;
using Application.Interfaces;
using Domain.Entities;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;
using Infrastructure.Contexts;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// Repositorio EF Core de categorías.
/// </summary>
public class CategoryRepository(ApplicationDbContext context) : ICategoryRepository
{
    private const int SqliteConstraintError = 19;

    /// <inheritdoc />
    public Task<Category?> GetByIdAsync(Guid id, CancellationToken ct)
        => context.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);

    /// <inheritdoc />
    public Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var lower = name.ToLower();
        return context.Categories.AsNoTracking()
            .AnyAsync(c => c.Name.ToLower() == lower && (excludeId == null || c.Id != excludeId), ct);
    }

    /// <inheritdoc />
    public async Task<PagedResult<Category>> ListAsync(
        CategoryFilter filter, PaginationCriteria paging, SortingCriteria sorting, CancellationToken ct)
    {
        var query = context.Categories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            var text = filter.Name.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(text));
        }

        var total = await query.CountAsync(ct).ConfigureAwait(false);

        var ordered = sorting.SortDesc
            ? query.OrderByDescending(c => c.Name).ThenBy(c => c.Id)
            : query.OrderBy(c => c.Name).ThenBy(c => c.Id);

        var items = await ordered
            .Skip((paging.CurrentPage - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new PagedResult<Category>
        {
            Items = items,
            CurrentPage = paging.CurrentPage,
            PageSize = paging.PageSize,
            TotalCount = total,
        };
    }

    /// <inheritdoc />
    public async Task AddAsync(Category category, CancellationToken ct)
    {
        context.Categories.Add(category);
        await SaveTranslatingConflictsAsync(category.Name, ct).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task UpdateAsync(Category category, CancellationToken ct)
        => SaveTranslatingConflictsAsync(category.Name, ct);

    /// <inheritdoc />
    public async Task DeleteAsync(Category category, CancellationToken ct)
    {
        context.Categories.Remove(category);
        await context.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    private async Task SaveTranslatingConflictsAsync(string name, CancellationToken ct)
    {
        try
        {
            await context.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqliteException { SqliteErrorCode: SqliteConstraintError })
        {
            throw new ConflictException($"Ya existe una categoría con el nombre '{name}'.");
        }
    }
}
