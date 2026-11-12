namespace Domain.Pagination;

/// <summary>
/// Criterios de paginación de un listado.
/// </summary>
public class PaginationCriteria
{
    /// <summary>Página actual (empieza en 1).</summary>
    public int CurrentPage { get; set; } = 1;

    /// <summary>Número de elementos por página.</summary>
    public int PageSize { get; set; } = 20;
}
