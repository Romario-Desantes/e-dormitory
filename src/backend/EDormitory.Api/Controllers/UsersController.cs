using EDormitory.Api.Security;
using EDormitory.Application.Contracts.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController(IUserService userService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Policies.ManageUsers)]
    public async Task<ActionResult<IReadOnlyCollection<UserResponse>>> GetUsers(CancellationToken cancellationToken) =>
        Ok(await userService.GetUsersAsync(cancellationToken));

    [HttpGet("search")]
    [Authorize(Policy = Policies.ManageRooms)]
    public async Task<ActionResult<IReadOnlyCollection<UserLookupResponse>>> SearchUsers([FromQuery] string? role, [FromQuery] string? q, CancellationToken cancellationToken) =>
        Ok(await userService.SearchUsersAsync(role, q, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Policies.ManageUsers)]
    public async Task<ActionResult<UserResponse>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken) =>
        Ok(await userService.CreateUserAsync(request, cancellationToken));

    [HttpPost("{id:guid}/reset-password")]
    [Authorize(Policy = Policies.ManageUsers)]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await userService.ResetPasswordAsync(request with { UserId = id }, cancellationToken);
        return NoContent();
    }
}
