namespace Domain.Filters.Categories;

/// <summary>
/// Filtro del listado de categorías.
/// </summary>
public class CategoryFilter
{
    /// <summary>Texto contenido en el nombre (sin distinguir mayúsculas).</summary>
    public string? Name { get; set; }
}
