namespace Domain.Entities;

/// <summary>
/// Categoría de libros.
/// </summary>
public class Category
{
    /// <summary>Identificador único.</summary>
    public Guid Id { get; set; }

    /// <summary>Nombre (único sin distinguir mayúsculas).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Descripción opcional.</summary>
    public string? Description { get; set; }
}
