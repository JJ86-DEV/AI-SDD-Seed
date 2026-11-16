using Api.Controllers;
using Application.Interfaces;
using Application.Models.Categories;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace UnitTests.Api;

[TestClass]
public class CategoriesControllerTests
{
    private static readonly CategoryDto Dto = new() { Id = Guid.NewGuid(), Name = "Historia" };
    private readonly Mock<ICategoryService> _service = new();
    private readonly CancellationToken _ct = CancellationToken.None;

    private CategoriesController Sut() => new(_service.Object);

    [TestMethod]
    public async Task CreateCategory_ReturnsCreatedAtAction()
    {
        // Arrange
        var model = new CreateCategory { Name = "Historia" };
        _service.Setup(s => s.CreateAsync(model, _ct)).ReturnsAsync(Dto);

        // Act
        var result = await Sut().CreateCategory(model, _ct);

        // Assert
        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        created.StatusCode.Should().Be(201);
        created.ActionName.Should().Be("GetCategory");
        created.RouteValues!["id"].Should().Be(Dto.Id);
        created.Value.Should().Be(Dto);
    }

    [TestMethod]
    public async Task GetCategory_ReturnsOk()
    {
        // Arrange
        _service.Setup(s => s.GetAsync(Dto.Id, _ct)).ReturnsAsync(Dto);

        // Act
        var result = await Sut().GetCategory(Dto.Id, _ct);

        // Assert
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(Dto);
    }

    [TestMethod]
    public async Task UpdateCategory_ReturnsOk()
    {
        // Arrange
        var model = new UpdateCategory { Name = "Historia" };
        _service.Setup(s => s.UpdateAsync(Dto.Id, model, _ct)).ReturnsAsync(Dto);

        // Act
        var result = await Sut().UpdateCategory(Dto.Id, model, _ct);

        // Assert
        result.Should().BeOfType<OkObjectResult>().Which.Value.Should().Be(Dto);
    }

    [TestMethod]
    public async Task DeleteCategory_ReturnsNoContent()
    {
        // Act
        var result = await Sut().DeleteCategory(Dto.Id, _ct);

        // Assert
        result.Should().BeOfType<NoContentResult>().Which.StatusCode.Should().Be(204);
        _service.Verify(s => s.DeleteAsync(Dto.Id, _ct), Times.Once);
    }

    [TestMethod]
    public async Task ListCategories_NullFilter_PassesEmptyFilterAndReturnsOk()
    {
        // Arrange
        var paged = new PagedResult<CategoryDto> { Items = [Dto], CurrentPage = 1, PageSize = 20, TotalCount = 1 };
        _service.Setup(s => s.ListAsync(It.IsAny<CategoryFilter>(), It.IsAny<PaginationCriteria>(), It.IsAny<SortingCriteria>(), _ct))
            .ReturnsAsync(paged);

        // Act
        var result = await Sut().ListCategories(null, new PaginationCriteria(), new SortingCriteria(), _ct);

        // Assert
        var value = result.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<PagedResult<CategoryDto>>().Subject;
        value.Items.Should().ContainSingle();
        value.CurrentPage.Should().Be(1);
        value.PageSize.Should().Be(20);
        value.TotalCount.Should().Be(1);
        _service.Verify(s => s.ListAsync(
            It.Is<CategoryFilter>(f => f.Name == null), It.IsAny<PaginationCriteria>(), It.IsAny<SortingCriteria>(), _ct), Times.Once);
    }
}
