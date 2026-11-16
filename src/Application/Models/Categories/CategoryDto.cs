namespace Application.Models.Categories;

/// <summary>
/// Representación de lectura de una categoría.
/// </summary>
public class CategoryDto
{
    /// <summary>Identificador.</summary>
    public Guid Id { get; set; }

    /// <summary>Nombre.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Descripción.</summary>
    public string? Description { get; set; }
}
