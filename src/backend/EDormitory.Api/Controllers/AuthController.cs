using EDormitory.Api.Security;
using EDormitory.Application.Contracts.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var session = await authService.LoginAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString(), cancellationToken);
        WriteCookies(session);
        return Ok(session.Response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken)
    {
        var refreshToken = Request.Cookies[CookieNames.RefreshToken];
        var csrfToken = Request.Headers["X-CSRF-TOKEN"].ToString();
        if (string.IsNullOrWhiteSpace(refreshToken) || string.IsNullOrWhiteSpace(csrfToken))
        {
            return Unauthorized();
        }

        var session = await authService.RefreshAsync(refreshToken, csrfToken, HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString(), cancellationToken);
        WriteCookies(session);
        return Ok(session.Response);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(User.GetSessionId(), Request.Cookies[CookieNames.RefreshToken], cancellationToken);
        ClearCookies();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthenticatedUserResponse>> Me(CancellationToken cancellationToken) =>
        Ok(await authService.GetCurrentUserAsync(cancellationToken));

    private void WriteCookies(AuthSessionResult session)
    {
        Response.Cookies.Append(CookieNames.AccessToken, session.AccessToken, BuildCookie(httpOnly: true, expires: session.Response.ExpiresAt));
        Response.Cookies.Append(CookieNames.RefreshToken, session.RefreshToken, BuildCookie(httpOnly: true, expires: DateTimeOffset.UtcNow.AddDays(7)));
        Response.Cookies.Append(CookieNames.CsrfToken, session.CsrfToken, BuildCookie(httpOnly: false, expires: DateTimeOffset.UtcNow.AddDays(7)));
    }

    private void ClearCookies()
    {
        Response.Cookies.Delete(CookieNames.AccessToken);
        Response.Cookies.Delete(CookieNames.RefreshToken);
        Response.Cookies.Delete(CookieNames.CsrfToken);
    }

    private CookieOptions BuildCookie(bool httpOnly, DateTimeOffset expires) => new()
    {
        HttpOnly = httpOnly,
        Secure = Request.IsHttps || string.Equals(Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase),
        SameSite = SameSiteMode.Lax,
        Expires = expires,
        IsEssential = true,
    };
}
