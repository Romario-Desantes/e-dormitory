using EDormitory.Application.Abstractions;
using EDormitory.Application.Common;
using EDormitory.Application.Contracts.Auth;
using EDormitory.Application.Contracts.Users;
using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Billing;
using EDormitory.Domain.Common;
using EDormitory.Domain.Identity;
using EDormitory.Infrastructure.Auth;
using EDormitory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EDormitory.Infrastructure.Services;

public sealed class AuthService(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    ICurrentUserContext currentUser,
    IClock clock,
    IAuditService auditService,
    IOptions<JwtOptions> options) : IAuthService
{
    private readonly JwtOptions _options = options.Value;

    public async Task<AuthSessionResult> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await auditService.LogSecurityEventAsync(null, "auth.login.failed", normalizedEmail, ipAddress, userAgent, cancellationToken);
            throw new ForbiddenException("Неправильний email або пароль.");
        }

        var now = clock.UtcNow;
        var session = new UserSession
        {
            UserId = user.Id,
            CsrfToken = Guid.NewGuid().ToString("N"),
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
            LastActivityAt = now,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedBy = user.Id,
        };

        var refreshTokenValue = tokenService.CreateRefreshToken();
        dbContext.UserSessions.Add(session);
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Session = session,
            TokenHash = tokenService.HashRefreshToken(refreshTokenValue),
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
            JwtId = Guid.NewGuid().ToString("N"),
            CreatedBy = user.Id,
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogSecurityEventAsync(user.Id, "auth.login.success", user.Email, ipAddress, userAgent, cancellationToken);
        return user.BuildSessionResult(session, refreshTokenValue, tokenService, _options, now);
    }

    public async Task<AuthSessionResult> RefreshAsync(string refreshToken, string csrfToken, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default)
    {
        var tokenHash = tokenService.HashRefreshToken(refreshToken);
        var token = await dbContext.RefreshTokens
            .Include(x => x.Session)
            .ThenInclude(x => x.User)
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

        if (token is null || !token.IsUsable(clock.UtcNow) || token.Session.IsExpired(clock.UtcNow, TimeSpan.FromMinutes(_options.SessionIdleMinutes)))
        {
            await auditService.LogSecurityEventAsync(null, "auth.refresh.failed", "invalid token", ipAddress, userAgent, cancellationToken);
            throw new ForbiddenException("Сесію завершено. Увійдіть повторно.");
        }

        if (!string.Equals(token.Session.CsrfToken, csrfToken, StringComparison.Ordinal))
        {
            throw new ForbiddenException("Недійсний CSRF токен.");
        }

        token.RevokedAt = clock.UtcNow;
        token.Touch(token.Session.UserId);

        var replacementValue = tokenService.CreateRefreshToken();
        var replacement = new RefreshToken
        {
            SessionId = token.SessionId,
            TokenHash = tokenService.HashRefreshToken(replacementValue),
            ExpiresAt = clock.UtcNow.AddDays(_options.RefreshTokenDays),
            JwtId = Guid.NewGuid().ToString("N"),
            CreatedBy = token.Session.UserId,
        };

        token.ReplacedByTokenId = replacement.Id;
        token.Session.LastActivityAt = clock.UtcNow;
        token.Session.CsrfToken = Guid.NewGuid().ToString("N");
        token.Session.IpAddress = ipAddress;
        token.Session.UserAgent = userAgent;
        token.Session.Touch(token.Session.UserId);

        dbContext.RefreshTokens.Add(replacement);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogSecurityEventAsync(token.Session.UserId, "auth.refresh.success", token.Session.User.Email, ipAddress, userAgent, cancellationToken);

        return token.Session.User.BuildSessionResult(token.Session, replacementValue, tokenService, _options, clock.UtcNow);
    }

    public async Task LogoutAsync(Guid? sessionId, string? refreshToken, CancellationToken cancellationToken = default)
    {
        UserSession? session = null;

        if (sessionId.HasValue)
        {
            session = await dbContext.UserSessions.FirstOrDefaultAsync(x => x.Id == sessionId.Value, cancellationToken);
        }

        if (session is null && !string.IsNullOrWhiteSpace(refreshToken))
        {
            var hash = tokenService.HashRefreshToken(refreshToken);
            session = await dbContext.RefreshTokens
                .Include(x => x.Session)
                .Where(x => x.TokenHash == hash)
                .Select(x => x.Session)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (session is null)
        {
            return;
        }

        session.IsRevoked = true;
        session.Touch(currentUser.UserId);

        var tokens = await dbContext.RefreshTokens.Where(x => x.SessionId == session.Id).ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAt ??= clock.UtcNow;
            token.Touch(currentUser.UserId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogSecurityEventAsync(session.UserId, "auth.logout", session.Id.ToString(), null, null, cancellationToken);
    }

    public async Task<AuthenticatedUserResponse> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.UserId.HasValue)
        {
            throw new ForbiddenException("Користувач не авторизований.");
        }

        var user = await dbContext.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == currentUser.UserId.Value, cancellationToken)
            ?? throw new NotFoundException("Користувача не знайдено.");

        var balance = await GetOutstandingBalanceAsync(user.Id, user.Balance, cancellationToken);
        return user.ToAuthenticatedUser(balance);
    }

    private async Task<decimal> GetOutstandingBalanceAsync(Guid userId, decimal fallbackBalance, CancellationToken cancellationToken)
    {
        var outstanding = await dbContext.StudentCharges
            .Where(charge => charge.UserId == userId)
            .SumAsync(charge => (decimal?)(charge.Amount - charge.PaidAmount), cancellationToken);

        return Math.Max(0m, outstanding ?? fallbackBalance);
    }
}

public sealed class UserService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IPasswordHasher passwordHasher,
    IAuditService auditService) : IUserService
{
    public async Task<IReadOnlyCollection<UserResponse>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        var users = await dbContext.Users
            .Include(x => x.Role)
            .Include(x => x.Room)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        var balances = await GetOutstandingBalancesAsync(users.Select(x => x.Id), cancellationToken);
        return users.Select(x => x.ToResponse(GetEffectiveBalance(x.Id, x.Balance, balances))).ToList();
    }

    public async Task<IReadOnlyCollection<UserLookupResponse>> SearchUsersAsync(string? role, string? query, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin, UserRole.Commandant);

        var usersQuery = dbContext.Users
            .Include(x => x.Role)
            .Include(x => x.Room)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var roleValue))
        {
            usersQuery = usersQuery.Where(x => x.Role.Name == roleValue);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalized = query.Trim().ToLowerInvariant();
            usersQuery = usersQuery.Where(x =>
                x.FullName.ToLower().Contains(normalized) ||
                x.Email.ToLower().Contains(normalized) ||
                x.Room != null && x.Room.RoomNumber.ToLower().Contains(normalized));
        }

        var users = await usersQuery
            .OrderBy(x => x.FullName)
            .Take(20)
            .ToListAsync(cancellationToken);

        var balances = await GetOutstandingBalancesAsync(users.Select(x => x.Id), cancellationToken);
        return users.Select(x => x.ToLookup(GetEffectiveBalance(x.Id, x.Balance, balances))).ToList();
    }

    public async Task<UserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            throw new ConflictException("Користувач з таким email уже існує.");
        }

        var roleValue = Enum.Parse<UserRole>(request.Role, true);
        var role = await dbContext.Roles.FirstAsync(x => x.Name == roleValue, cancellationToken);
        Room? room = null;
        TariffPlan? tariff = null;

        if (roleValue == UserRole.Student && request.RoomId.HasValue)
        {
            room = await dbContext.Rooms.FirstOrDefaultAsync(x => x.Id == request.RoomId.Value, cancellationToken)
                ?? throw new NotFoundException("Кімнату не знайдено.");
        }

        if (roleValue == UserRole.Student && request.TariffId.HasValue)
        {
            tariff = await dbContext.Tariffs.FirstOrDefaultAsync(x => x.Id == request.TariffId.Value, cancellationToken)
                ?? throw new NotFoundException("Тариф не знайдено.");
        }

        var initialChargeAmount = tariff?.MonthlyRate ?? room?.MonthlyRate ?? 0m;

        var user = new User
        {
            RoleId = role.Id,
            RoomId = request.RoomId,
            FullName = request.FullName.Trim(),
            Email = normalizedEmail,
            Phone = request.Phone.Trim(),
            PasswordHash = passwordHasher.Hash("ChangeMe123!"),
            MustChangePassword = true,
            Balance = initialChargeAmount,
            CreatedBy = currentUser.UserId,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (roleValue == UserRole.Student && initialChargeAmount > 0m)
        {
            dbContext.StudentCharges.Add(new StudentCharge
            {
                UserId = user.Id,
                Title = $"Проживання за {DateTimeOffset.UtcNow:MMMM yyyy}",
                Amount = initialChargeAmount,
                Currency = "UAH",
                DueDate = DateTimeOffset.UtcNow.AddDays(7),
                CreatedBy = currentUser.UserId,
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        user.Role = role;
        await auditService.LogAsync(nameof(User), user.Id, "user.created", currentUser.UserId, new { user.Email, Role = role.Name }, cancellationToken);
        return user.ToResponse(user.Balance);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.UserId, cancellationToken)
            ?? throw new NotFoundException("Користувача не знайдено.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        user.MustChangePassword = false;
        user.IncreaseTokenVersion(currentUser.UserId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogSecurityEventAsync(user.Id, "auth.password.reset", user.Email, null, null, cancellationToken);
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("Недостатньо прав для цієї дії.");
        }
    }

    private async Task<Dictionary<Guid, decimal>> GetOutstandingBalancesAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken)
    {
        var ids = userIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        return await dbContext.StudentCharges
            .Where(charge => ids.Contains(charge.UserId))
            .GroupBy(charge => charge.UserId)
            .Select(group => new
            {
                UserId = group.Key,
                Balance = group.Sum(charge => charge.Amount - charge.PaidAmount),
            })
            .ToDictionaryAsync(item => item.UserId, item => Math.Max(0m, item.Balance), cancellationToken);
    }

    private static decimal GetEffectiveBalance(Guid userId, decimal fallbackBalance, IReadOnlyDictionary<Guid, decimal> balances) =>
        balances.TryGetValue(userId, out var balance) ? balance : fallbackBalance;
}

internal static partial class MappingExtensions
{
    public static AuthenticatedUserResponse ToAuthenticatedUser(this User user, decimal? balance = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, user.MustChangePassword, balance ?? user.Balance);

    public static UserResponse ToResponse(this User user, decimal? balance = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, balance ?? user.Balance, user.MustChangePassword, user.IsActive);

    public static UserLookupResponse ToLookup(this User user, decimal? balance = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, user.Room?.RoomNumber, balance ?? user.Balance);

    public static AuthSessionResult BuildSessionResult(this User user, UserSession session, string refreshToken, ITokenService tokenService, JwtOptions options, DateTimeOffset now)
    {
        var accessExpiry = now.AddMinutes(options.AccessTokenMinutes);
        var accessToken = tokenService.CreateAccessToken(new TokenDescriptor(user.Id, session.Id, user.Email, user.Role.Name, user.TokenVersion, accessExpiry));

        return new AuthSessionResult(
            new AuthResponse(user.ToAuthenticatedUser(), accessExpiry),
            accessToken,
            refreshToken,
            session.CsrfToken);
    }
}
