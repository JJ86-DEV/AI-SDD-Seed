using Application.Models.Categories;
using Domain.Entities;

namespace Application.Mappings;

/// <summary>
/// Conversiones entre Category y sus DTOs.
/// </summary>
public static class CategoryMappings
{
    /// <summary>Convierte la entidad en DTO.</summary>
    public static CategoryDto ToDto(this Category category)
    {
        ArgumentNullException.ThrowIfNull(category);
        return new CategoryDto { Id = category.Id, Name = category.Name, Description = category.Description };
    }

    /// <summary>Crea una entidad (sin Id) a partir del DTO de creación.</summary>
    public static Category ToEntity(this CreateCategory model)
    {
        ArgumentNullException.ThrowIfNull(model);
        return new Category { Name = model.Name, Description = model.Description };
    }

    /// <summary>Copia los datos del DTO de actualización a la entidad.</summary>
    public static void ApplyTo(this UpdateCategory model, Category category)
    {
        ArgumentNullException.ThrowIfNull(model);
        ArgumentNullException.ThrowIfNull(category);
        category.Name = model.Name;
        category.Description = model.Description;
    }
}
