using System.Security.Claims;
using EDormitory.Application.Abstractions;
using EDormitory.Domain.Common;

namespace EDormitory.Api.Security;

public sealed class HttpCurrentUserContext(IHttpContextAccessor accessor) : ICurrentUserContext
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;

    public Guid? UserId => Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub"), out var id) ? id : null;
    public Guid? SessionId => Guid.TryParse(User?.FindFirstValue("sid"), out var id) ? id : null;
    public UserRole? Role => Enum.TryParse<UserRole>(User?.FindFirstValue(ClaimTypes.Role), true, out var role) ? role : null;
    public string? Email => User?.FindFirstValue(ClaimTypes.Email) ?? User?.FindFirstValue("email");
    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
}
