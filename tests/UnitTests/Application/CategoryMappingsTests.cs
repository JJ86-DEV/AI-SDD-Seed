using Application.Mappings;
using Application.Models.Categories;
using Domain.Entities;
using FluentAssertions;

namespace UnitTests.Application;

[TestClass]
public class CategoryMappingsTests
{
    [TestMethod]
    public void ToDto_CopiesAllFields()
    {
        // Arrange
        var entity = new Category { Id = Guid.NewGuid(), Name = "Historia", Description = "Ensayo histórico" };

        // Act
        var dto = entity.ToDto();

        // Assert
        dto.Id.Should().Be(entity.Id);
        dto.Name.Should().Be("Historia");
        dto.Description.Should().Be("Ensayo histórico");
    }

    [TestMethod]
    public void ToEntity_DoesNotAssignId()
    {
        // Arrange
        var model = new CreateCategory { Name = "Poesía", Description = "Verso" };

        // Act
        var entity = model.ToEntity();

        // Assert
        entity.Id.Should().BeEmpty();
        entity.Name.Should().Be("Poesía");
        entity.Description.Should().Be("Verso");
    }

    [TestMethod]
    public void ApplyTo_CopiesNameAndDescription()
    {
        // Arrange
        var entity = new Category { Id = Guid.NewGuid(), Name = "Old", Description = "x" };
        var model = new UpdateCategory { Name = "New", Description = null };

        // Act
        model.ApplyTo(entity);

        // Assert
        entity.Name.Should().Be("New");
        entity.Description.Should().BeNull();
    }
}
