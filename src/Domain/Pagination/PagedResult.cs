namespace Domain.Pagination;

/// <summary>
/// Resultado paginado de un listado.
/// </summary>
/// <typeparam name="T">Tipo de los elementos.</typeparam>
public class PagedResult<T>
{
    /// <summary>Elementos de la página actual.</summary>
    public IReadOnlyList<T> Items { get; init; } = [];

    /// <summary>Página actual (empieza en 1).</summary>
    public int CurrentPage { get; init; }

    /// <summary>Número de elementos por página.</summary>
    public int PageSize { get; init; }

    /// <summary>Total de elementos que cumplen el filtro.</summary>
    public int TotalCount { get; init; }

    /// <summary>Total de páginas.</summary>
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}
