using System.ComponentModel.DataAnnotations;
using Domain.Constants;

namespace Application.Models.Categories;

/// <summary>
/// Datos de entrada para la operacion CreateCategory.
/// </summary>
public class CreateCategory
{
    /// <summary>Nombre (obligatorio).</summary>
    [Required]
    [StringLength(CategoryConstants.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Descripción opcional.</summary>
    [StringLength(CategoryConstants.DescriptionMaxLength)]
    public string? Description { get; set; }
}
