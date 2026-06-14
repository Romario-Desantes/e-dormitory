using EDormitory.Application.Contracts.Directories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/directories")]
[Authorize]
public sealed class DirectoriesController(IDirectoryService directoryService) : ControllerBase
{
    [HttpGet("roles")]
    public async Task<ActionResult<IReadOnlyCollection<RoleDirectoryResponse>>> GetRoles(CancellationToken cancellationToken) =>
        Ok(await directoryService.GetRolesAsync(cancellationToken));
}
