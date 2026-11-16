using Application.Interfaces;
using Application.Models.Categories;
using Domain.Filters.Categories;
using Domain.Filters.Common;
using Domain.Pagination;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// CRUD y listado de categorías.
/// </summary>
[ApiController]
[Route("api/categories")]
[Produces("application/json")]
public class CategoriesController(ICategoryService service) : ControllerBase
{
    /// <summary>Crea una categoría.</summary>
    [HttpPost]
    [ActionName("CreateCategory")]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategory model, CancellationToken ct)
    {
        var dto = await service.CreateAsync(model, ct).ConfigureAwait(false);
        return CreatedAtAction("GetCategory", new { id = dto.Id }, dto);
    }

    /// <summary>Obtiene una categoría por id.</summary>
    [HttpGet("{id:guid}")]
    [ActionName("GetCategory")]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCategory([FromRoute] Guid id, CancellationToken ct)
        => Ok(await service.GetAsync(id, ct).ConfigureAwait(false));

    /// <summary>Actualiza (reemplazo completo) una categoría.</summary>
    [HttpPut("{id:guid}")]
    [ActionName("UpdateCategory")]
    [ProducesResponseType<CategoryDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateCategory([FromRoute] Guid id, [FromBody] UpdateCategory model, CancellationToken ct)
        => Ok(await service.UpdateAsync(id, model, ct).ConfigureAwait(false));

    /// <summary>Elimina una categoría.</summary>
    [HttpDelete("{id:guid}")]
    [ActionName("DeleteCategory")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteCategory([FromRoute] Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct).ConfigureAwait(false);
        return NoContent();
    }

    /// <summary>Lista categorías con filtro, paginación y ordenación.</summary>
    [HttpPost("list")]
    [ActionName("ListCategories")]
    [ProducesResponseType<PagedResult<CategoryDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ListCategories(
        [FromBody] CategoryFilter? filter,
        [FromQuery] PaginationCriteria paging,
        [FromQuery] SortingCriteria sorting,
        CancellationToken ct)
        => Ok(await service.ListAsync(filter ?? new CategoryFilter(), paging, sorting, ct).ConfigureAwait(false));
}
