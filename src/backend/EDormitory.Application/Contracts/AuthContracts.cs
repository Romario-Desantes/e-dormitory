using FluentValidation;

namespace EDormitory.Application.Contracts.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthenticatedUserResponse(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string Role,
    Guid? RoomId,
    bool MustChangePassword,
    decimal Balance);

public sealed record AuthResponse(AuthenticatedUserResponse User, DateTimeOffset ExpiresAt);

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
    }
}

public interface IAuthService
{
    Task<AuthSessionResult> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task<AuthSessionResult> RefreshAsync(string refreshToken, string csrfToken, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
    Task LogoutAsync(Guid? sessionId, string? refreshToken, CancellationToken cancellationToken = default);
    Task<AuthenticatedUserResponse> GetCurrentUserAsync(CancellationToken cancellationToken = default);
}

public sealed record AuthSessionResult(
    AuthResponse Response,
    string AccessToken,
    string RefreshToken,
    string CsrfToken);
