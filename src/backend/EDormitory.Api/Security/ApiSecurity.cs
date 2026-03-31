using EDormitory.Application.Abstractions;
using EDormitory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EDormitory.Api.Security;

public static class Policies
{
    public const string ManageUsers = "manage-users";
    public const string ManageRooms = "manage-rooms";
    public const string ManagePayments = "manage-payments";
}

public static class CookieNames
{
    public const string AccessToken = "edormitory_at";
    public const string RefreshToken = "edormitory_rt";
    public const string CsrfToken = "edormitory_csrf";
}

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetSessionId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sid"), out var sessionId) ? sessionId : null;
}

public sealed class CsrfProtectionMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SafeMethods = [HttpMethods.Get, HttpMethods.Head, HttpMethods.Options];
    private static readonly HashSet<string> IgnoredPaths = ["/api/auth/login", "/api/auth/refresh", "/api/payments/webhook/mock", "/api/health"];

    public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
    {
        if (!SafeMethods.Contains(context.Request.Method)
            && context.User.Identity?.IsAuthenticated == true
            && !IgnoredPaths.Contains(context.Request.Path.Value ?? string.Empty))
        {
            var sid = context.User.FindFirst("sid")?.Value;
            if (!Guid.TryParse(sid, out var sessionId))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { detail = "Недійсна сесія." });
                return;
            }

            var header = context.Request.Headers["X-CSRF-TOKEN"].ToString();
            var cookie = context.Request.Cookies[CookieNames.CsrfToken];
            var session = await dbContext.UserSessions.FirstOrDefaultAsync(x => x.Id == sessionId, context.RequestAborted);

            if (session is null || string.IsNullOrWhiteSpace(header) || header != cookie || header != session.CsrfToken)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { detail = "CSRF перевірку не пройдено." });
                return;
            }
        }

        await next(context);
    }
}

public sealed class SessionActivityMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDbContext dbContext, ICurrentUserContext currentUser, IClock clock)
    {
        if (currentUser.IsAuthenticated && currentUser.SessionId.HasValue)
        {
            var session = await dbContext.UserSessions.FirstOrDefaultAsync(x => x.Id == currentUser.SessionId.Value, context.RequestAborted);
            if (session is not null)
            {
                session.LastActivityAt = clock.UtcNow;
                session.Touch(currentUser.UserId);
                await dbContext.SaveChangesAsync(context.RequestAborted);
            }
        }

        await next(context);
    }
}
