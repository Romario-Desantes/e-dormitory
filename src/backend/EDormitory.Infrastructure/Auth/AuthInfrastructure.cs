using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EDormitory.Application.Abstractions;
using Konscious.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EDormitory.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Auth";
    public string Issuer { get; set; } = "EDormitory";
    public string Audience { get; set; } = "EDormitory.Web";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
    public int SessionIdleMinutes { get; set; } = 60;
}

public sealed class StorageOptions
{
    public const string SectionName = "Storage";
    public string Provider { get; set; } = "Disk";
    public string RootPath { get; set; } = "storage";
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

public sealed class Argon2PasswordHasher : IPasswordHasher
{
    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = 8,
            Iterations = 4,
            MemorySize = 1024 * 64,
        };

        var hash = argon2.GetBytes(32);
        return $"argon2id${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string hash)
    {
        var parts = hash.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3 || !string.Equals(parts[0], "argon2id", StringComparison.Ordinal))
        {
            return false;
        }

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = Convert.FromBase64String(parts[1]),
            DegreeOfParallelism = 8,
            Iterations = 4,
            MemorySize = 1024 * 64,
        };

        var expectedHash = Convert.FromBase64String(parts[2]);
        var actualHash = argon2.GetBytes(32);
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }
}

public sealed class JwtTokenService(IOptions<JwtOptions> options) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public string CreateAccessToken(TokenDescriptor descriptor)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, descriptor.UserId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, descriptor.UserId.ToString()),
                new Claim(ClaimTypes.Email, descriptor.Email),
                new Claim(JwtRegisteredClaimNames.Email, descriptor.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim(ClaimTypes.Role, descriptor.Role.ToString()),
                new Claim("sid", descriptor.SessionId.ToString()),
                new Claim("tv", descriptor.TokenVersion.ToString()),
            ],
            expires: descriptor.ExpiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public string HashRefreshToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash);
    }
}
