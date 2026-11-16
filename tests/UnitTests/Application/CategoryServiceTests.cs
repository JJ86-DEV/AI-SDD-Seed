using Application.Exceptions;
using Application.Interfaces;
using Application.Models.Categories;
using Application.Services;
using Domain.Entities;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;
using FluentAssertions;
using Moq;

namespace UnitTests.Application;

[TestClass]
public class CategoryServiceTests
{
    private readonly Mock<ICategoryRepository> _repo = new();
    private readonly Mock<ICategoryDeletionGuard> _guard = new();
    private readonly CancellationToken _ct = CancellationToken.None;

    private CategoryService Sut() => new(_repo.Object, _guard.Object);

    private static Category Existing(Guid? id = null) =>
        new() { Id = id ?? Guid.NewGuid(), Name = "Ciencias", Description = null };

    [TestMethod]
    public void Constructor_NullDependencies_Throws()
    {
        // Act
        var act1 = () => new CategoryService(null!, _guard.Object);
        var act2 = () => new CategoryService(_repo.Object, null!);

        // Assert
        act1.Should().Throw<ArgumentNullException>();
        act2.Should().Throw<ArgumentNullException>();
    }

    [TestMethod]
    public async Task CreateAsync_Valid_ReturnsDtoAndAdds()
    {
        // Act
        var dto = await Sut().CreateAsync(new CreateCategory { Name = "Poesía", Description = "Verso" }, _ct);

        // Assert
        dto.Id.Should().NotBeEmpty();
        dto.Name.Should().Be("Poesía");
        _repo.Verify(r => r.AddAsync(It.IsAny<Category>(), _ct), Times.Once);
    }

    [TestMethod]
    public async Task CreateAsync_NameWithSpaces_IsTrimmed()
    {
        // Act
        var dto = await Sut().CreateAsync(new CreateCategory { Name = "  Historia  " }, _ct);

        // Assert
        dto.Name.Should().Be("Historia");
        _repo.Verify(r => r.ExistsByNameAsync("Historia", null, _ct), Times.Once);
    }

    [TestMethod]
    public async Task CreateAsync_BlankDescription_BecomesNull()
    {
        // Act
        var dto = await Sut().CreateAsync(new CreateCategory { Name = "Historia", Description = "   " }, _ct);

        // Assert
        dto.Description.Should().BeNull();
    }

    [TestMethod]
    public async Task CreateAsync_EmptyName_ThrowsValidation()
    {
        // Act
        var act = () => Sut().CreateAsync(new CreateCategory { Name = "   " }, _ct);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();
    }

    [TestMethod]
    public async Task CreateAsync_Duplicate_ThrowsConflictAndDoesNotAdd()
    {
        // Arrange
        _repo.Setup(r => r.ExistsByNameAsync("Historia", null, _ct)).ReturnsAsync(true);

        // Act
        var act = () => Sut().CreateAsync(new CreateCategory { Name = "Historia" }, _ct);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
        _repo.Verify(r => r.AddAsync(It.IsAny<Category>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [TestMethod]
    public async Task GetAsync_Existing_ReturnsDto()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);

        // Act
        var dto = await Sut().GetAsync(entity.Id, _ct);

        // Assert
        dto.Id.Should().Be(entity.Id);
    }

    [TestMethod]
    public async Task GetAsync_Missing_ThrowsNotFound()
    {
        // Act
        var act = () => Sut().GetAsync(Guid.NewGuid(), _ct);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [TestMethod]
    public async Task UpdateAsync_Valid_UpdatesAndReturnsDto()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);

        // Act
        var dto = await Sut().UpdateAsync(entity.Id, new UpdateCategory { Name = "Nuevo", Description = "d" }, _ct);

        // Assert
        dto.Name.Should().Be("Nuevo");
        dto.Description.Should().Be("d");
        _repo.Verify(r => r.UpdateAsync(entity, _ct), Times.Once);
    }

    [TestMethod]
    public async Task UpdateAsync_Missing_ThrowsNotFound()
    {
        // Act
        var act = () => Sut().UpdateAsync(Guid.NewGuid(), new UpdateCategory { Name = "x" }, _ct);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [TestMethod]
    public async Task UpdateAsync_NameUsedByOther_ThrowsConflict()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);
        _repo.Setup(r => r.ExistsByNameAsync("Otra", entity.Id, _ct)).ReturnsAsync(true);

        // Act
        var act = () => Sut().UpdateAsync(entity.Id, new UpdateCategory { Name = "Otra" }, _ct);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
        _repo.Verify(r => r.UpdateAsync(It.IsAny<Category>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [TestMethod]
    public async Task UpdateAsync_SameOwnName_ExcludesOwnId()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);

        // Act
        var dto = await Sut().UpdateAsync(entity.Id, new UpdateCategory { Name = "CIENCIAS" }, _ct);

        // Assert
        dto.Name.Should().Be("CIENCIAS");
        _repo.Verify(r => r.ExistsByNameAsync("CIENCIAS", entity.Id, _ct), Times.Once);
    }

    [TestMethod]
    public async Task DeleteAsync_Existing_Deletes()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);

        // Act
        await Sut().DeleteAsync(entity.Id, _ct);

        // Assert
        _repo.Verify(r => r.DeleteAsync(entity, _ct), Times.Once);
    }

    [TestMethod]
    public async Task DeleteAsync_Missing_ThrowsNotFound()
    {
        // Act
        var act = () => Sut().DeleteAsync(Guid.NewGuid(), _ct);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [TestMethod]
    public async Task DeleteAsync_WithBooks_ThrowsConflictAndDoesNotDelete()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.GetByIdAsync(entity.Id, _ct)).ReturnsAsync(entity);
        _guard.Setup(g => g.HasBooksAsync(entity.Id, _ct)).ReturnsAsync(true);

        // Act
        var act = () => Sut().DeleteAsync(entity.Id, _ct);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
        _repo.Verify(r => r.DeleteAsync(It.IsAny<Category>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [TestMethod]
    [DataRow(0, 0, 1, 20)]
    [DataRow(-3, 500, 1, 100)]
    [DataRow(2, 10, 2, 10)]
    public async Task ListAsync_NormalizesPaging(int page, int size, int expectedPage, int expectedSize)
    {
        // Arrange
        _repo.Setup(r => r.ListAsync(It.IsAny<CategoryFilter>(), It.IsAny<PaginationCriteria>(), It.IsAny<SortingCriteria>(), _ct))
            .ReturnsAsync(new PagedResult<Category>());

        // Act
        var result = await Sut().ListAsync(
            new CategoryFilter(), new PaginationCriteria { CurrentPage = page, PageSize = size }, new SortingCriteria(), _ct);

        // Assert
        result.CurrentPage.Should().Be(expectedPage);
        result.PageSize.Should().Be(expectedSize);
        _repo.Verify(r => r.ListAsync(
            It.IsAny<CategoryFilter>(),
            It.Is<PaginationCriteria>(p => p.CurrentPage == expectedPage && p.PageSize == expectedSize),
            It.IsAny<SortingCriteria>(),
            _ct), Times.Once);
    }

    [TestMethod]
    public async Task ListAsync_InvalidSortBy_ThrowsValidation()
    {
        // Act
        var act = () => Sut().ListAsync(
            new CategoryFilter(), new PaginationCriteria(), new SortingCriteria { SortBy = "price" }, _ct);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();
    }

    [TestMethod]
    public async Task ListAsync_SortByNameUpperCase_IsValidAndMapsItems()
    {
        // Arrange
        var entity = Existing();
        _repo.Setup(r => r.ListAsync(It.IsAny<CategoryFilter>(), It.IsAny<PaginationCriteria>(), It.IsAny<SortingCriteria>(), _ct))
            .ReturnsAsync(new PagedResult<Category> { Items = [entity], CurrentPage = 1, PageSize = 20, TotalCount = 1 });

        // Act
        var result = await Sut().ListAsync(
            new CategoryFilter(), new PaginationCriteria(), new SortingCriteria { SortBy = "NAME" }, _ct);

        // Assert
        result.Items.Should().ContainSingle().Which.Id.Should().Be(entity.Id);
        result.TotalCount.Should().Be(1);
        result.TotalPages.Should().Be(1);
    }
}
