using Domain.Entities;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;
using FluentAssertions;
using Infrastructure.Contexts;
using Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace UnitTests.Infrastructure;

[TestClass]
public class CategoryRepositoryTests
{
    private static readonly string[] Names = ["Ciencia ficción", "Ciencias", "Historia", "Novela negra", "Poesía"];
    private readonly CancellationToken _ct = CancellationToken.None;

    private static ApplicationDbContext NewContext(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(dbName ?? Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task<ApplicationDbContext> SeededAsync()
    {
        var ctx = NewContext();
        // Orden de inserción invertido a propósito.
        foreach (var name in Names.Reverse())
        {
            ctx.Categories.Add(new Category { Id = Guid.NewGuid(), Name = name });
        }

        await ctx.SaveChangesAsync();
        return ctx;
    }

    private static PaginationCriteria Page(int page = 1, int size = 20) => new() { CurrentPage = page, PageSize = size };

    [TestMethod]
    [DataRow("ci")]
    [DataRow("CI")]
    public async Task ListAsync_NameFilter_ContainsIgnoringCase(string text)
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(
            new CategoryFilter { Name = text }, Page(), new SortingCriteria(), _ct);

        // Assert
        result.Items.Select(c => c.Name).Should().Equal("Ciencia ficción", "Ciencias");
        result.TotalCount.Should().Be(2);
    }

    [TestMethod]
    public async Task ListAsync_NoFilter_ReturnsAllSortedAsc()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(new CategoryFilter(), Page(), new SortingCriteria(), _ct);

        // Assert
        result.Items.Select(c => c.Name).Should().Equal(Names);
    }

    [TestMethod]
    public async Task ListAsync_SortDesc_ReturnsDescending()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(
            new CategoryFilter(), Page(), new SortingCriteria { SortBy = "name", SortDesc = true }, _ct);

        // Assert
        result.Items.Select(c => c.Name).Should().Equal(Names.Reverse());
    }

    [TestMethod]
    public async Task ListAsync_SecondPage_ReturnsThirdAndFourth()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(new CategoryFilter(), Page(2, 2), new SortingCriteria(), _ct);

        // Assert
        result.Items.Select(c => c.Name).Should().Equal("Historia", "Novela negra");
        result.TotalCount.Should().Be(5);
        result.TotalPages.Should().Be(3);
    }

    [TestMethod]
    public async Task ListAsync_PageOutOfRange_ReturnsEmptyItemsWithTotal()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(new CategoryFilter(), Page(9, 2), new SortingCriteria(), _ct);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(5);
    }

    [TestMethod]
    public async Task ListAsync_EmptyDatabase_ReturnsEmpty()
    {
        // Arrange
        await using var ctx = NewContext();

        // Act
        var result = await new CategoryRepository(ctx).ListAsync(new CategoryFilter(), Page(), new SortingCriteria(), _ct);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.TotalPages.Should().Be(0);
    }

    [TestMethod]
    public async Task ExistsByNameAsync_OtherCasing_ReturnsTrue()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var exists = await new CategoryRepository(ctx).ExistsByNameAsync("HISTORIA", null, _ct);

        // Assert
        exists.Should().BeTrue();
    }

    [TestMethod]
    public async Task ExistsByNameAsync_ExcludingOwnId_ReturnsFalse()
    {
        // Arrange
        await using var ctx = await SeededAsync();
        var own = await ctx.Categories.SingleAsync(c => c.Name == "Historia");

        // Act
        var exists = await new CategoryRepository(ctx).ExistsByNameAsync("historia", own.Id, _ct);

        // Assert
        exists.Should().BeFalse();
    }

    [TestMethod]
    public async Task ExistsByNameAsync_Unknown_ReturnsFalse()
    {
        // Arrange
        await using var ctx = await SeededAsync();

        // Act
        var exists = await new CategoryRepository(ctx).ExistsByNameAsync("zzz", null, _ct);

        // Assert
        exists.Should().BeFalse();
    }

    [TestMethod]
    public async Task AddUpdateDelete_PersistAndReadBack()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var id = Guid.NewGuid();
        await using var ctx = NewContext(dbName);
        var repo = new CategoryRepository(ctx);

        // Act + Assert: add
        await repo.AddAsync(new Category { Id = id, Name = "Nueva", Description = "d" }, _ct);
        var added = await repo.GetByIdAsync(id, _ct);
        added.Should().NotBeNull();

        // update
        added!.Name = "Cambiada";
        await repo.UpdateAsync(added, _ct);
        await using (var verify = NewContext(dbName))
        {
            (await verify.Categories.SingleAsync()).Name.Should().Be("Cambiada");
        }

        // delete
        await repo.DeleteAsync(added, _ct);
        (await repo.GetByIdAsync(id, _ct)).Should().BeNull();
    }
}
