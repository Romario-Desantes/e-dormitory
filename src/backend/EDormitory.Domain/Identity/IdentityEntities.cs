using EDormitory.Domain.Common;
using EDormitory.Domain.Accommodation;

namespace EDormitory.Domain.Identity;

public sealed class Role : AuditableEntity
{
    public UserRole Name { get; set; }
    public string Description { get; set; } = string.Empty;
    public ICollection<User> Users { get; set; } = new List<User>();
}

public sealed class UserSession : AuditableEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string CsrfToken { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset LastActivityAt { get; set; }
    public bool IsRevoked { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public bool IsExpired(DateTimeOffset now, TimeSpan inactivityWindow) =>
        IsRevoked || ExpiresAt <= now || LastActivityAt.Add(inactivityWindow) <= now;
}

public sealed class RefreshToken : AuditableEntity
{
    public Guid SessionId { get; set; }
    public UserSession Session { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public string JwtId { get; set; } = string.Empty;

    public bool IsUsable(DateTimeOffset now) => IsActive && RevokedAt is null && ExpiresAt > now;
}
