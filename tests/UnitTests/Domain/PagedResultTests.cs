using Domain.Pagination;
using FluentAssertions;

namespace UnitTests.Domain;

[TestClass]
public class PagedResultTests
{
    [TestMethod]
    [DataRow(0, 20, 0)]
    [DataRow(1, 20, 1)]
    [DataRow(20, 20, 1)]
    [DataRow(21, 20, 2)]
    [DataRow(100, 10, 10)]
    public void TotalPages_CalculatesCeiling(int totalCount, int pageSize, int expected)
    {
        // Arrange
        var result = new PagedResult<string> { TotalCount = totalCount, PageSize = pageSize, CurrentPage = 1 };

        // Act
        var totalPages = result.TotalPages;

        // Assert
        totalPages.Should().Be(expected);
    }

    [TestMethod]
    public void TotalPages_WithNonPositivePageSize_ReturnsZero()
    {
        // Arrange
        var result = new PagedResult<string> { TotalCount = 10, PageSize = 0 };

        // Act & Assert
        result.TotalPages.Should().Be(0);
    }
}
