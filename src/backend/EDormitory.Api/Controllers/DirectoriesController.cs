using EDormitory.Application.Contracts.Directories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/directories")]
[Authorize]
public sealed class DirectoriesController(IDirectoryService directoryService) : ControllerBase
{
    [HttpGet("ticket-categories")]
    public async Task<ActionResult<IReadOnlyCollection<TicketCategoryResponse>>> GetTicketCategories(CancellationToken cancellationToken) =>
        Ok(await directoryService.GetTicketCategoriesAsync(cancellationToken));

    [HttpPost("ticket-categories")]
    public async Task<ActionResult<TicketCategoryResponse>> CreateTicketCategory([FromBody] UpsertTicketCategoryRequest request, CancellationToken cancellationToken) =>
        Ok(await directoryService.CreateTicketCategoryAsync(request, cancellationToken));

    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyCollection<RoleDirectoryResponse>>> GetRoles(CancellationToken cancellationToken) =>
        Ok(await directoryService.GetRolesAsync(cancellationToken));

    [HttpGet("tariffs")]
    public async Task<ActionResult<IReadOnlyCollection<TariffResponse>>> GetTariffs(CancellationToken cancellationToken) =>
        Ok(await directoryService.GetTariffsAsync(cancellationToken));

    [HttpPost("tariffs")]
    public async Task<ActionResult<TariffResponse>> CreateTariff([FromBody] UpsertTariffRequest request, CancellationToken cancellationToken) =>
        Ok(await directoryService.CreateTariffAsync(request, cancellationToken));

    [HttpPatch("tariffs/{id:guid}")]
    public async Task<ActionResult<TariffResponse>> UpdateTariff(Guid id, [FromBody] UpsertTariffRequest request, CancellationToken cancellationToken) =>
        Ok(await directoryService.UpdateTariffAsync(id, request, cancellationToken));
}
