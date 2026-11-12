namespace Domain.Filters.Common;

/// <summary>
/// Criterios de ordenación de un listado.
/// </summary>
public class SortingCriteria
{
    /// <summary>Nombre de la propiedad por la que ordenar.</summary>
    public string? SortBy { get; set; }

    /// <summary>Si es <c>true</c>, orden descendente.</summary>
    public bool SortDesc { get; set; }
}
