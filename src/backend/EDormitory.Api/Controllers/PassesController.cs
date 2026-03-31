using EDormitory.Application.Contracts.Passes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/passes")]
[Authorize]
public sealed class PassesController(IPassService passService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<GuestPassResponse>>> GetPasses(CancellationToken cancellationToken) =>
        Ok(await passService.GetPassesAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<GuestPassResponse>> CreatePass([FromBody] CreateGuestPassRequest request, CancellationToken cancellationToken) =>
        Ok(await passService.CreatePassAsync(request, cancellationToken));

    [HttpPost("validate")]
    public async Task<ActionResult<PassLogResponse>> Validate([FromBody] ValidatePassRequest request, CancellationToken cancellationToken) =>
        Ok(await passService.ValidatePassAsync(request, cancellationToken));

    [HttpGet("logs")]
    public async Task<ActionResult<IReadOnlyCollection<PassLogResponse>>> GetLogs(CancellationToken cancellationToken) =>
        Ok(await passService.GetLogsAsync(cancellationToken));
}
