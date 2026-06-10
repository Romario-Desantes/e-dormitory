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
            throw new ForbiddenException("РќРµРїСЂР°РІРёР»СЊРЅРёР№ email Р°Р±Рѕ РїР°СЂРѕР»СЊ.");
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
            throw new ForbiddenException("РЎРµСЃС–СЋ Р·Р°РІРµСЂС€РµРЅРѕ. РЈРІС–Р№РґС–С‚СЊ РїРѕРІС‚РѕСЂРЅРѕ.");
        }

        if (!string.Equals(token.Session.CsrfToken, csrfToken, StringComparison.Ordinal))
        {
            throw new ForbiddenException("РќРµРґС–Р№СЃРЅРёР№ CSRF С‚РѕРєРµРЅ.");
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
            throw new ForbiddenException("РљРѕСЂРёСЃС‚СѓРІР°С‡ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅРёР№.");
        }

        var user = await dbContext.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == currentUser.UserId.Value, cancellationToken)
            ?? throw new NotFoundException("РљРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        var debtAmount = await GetDebtAmountAsync(user, cancellationToken);
        return user.ToAuthenticatedUser(debtAmount);
    }

    private async Task<decimal?> GetDebtAmountAsync(User user, CancellationToken cancellationToken)
    {
        if (user.Role.Name != UserRole.Student)
        {
            return null;
        }

        var balances = await dbContext.StudentCharges
            .Where(charge => charge.UserId == user.Id)
            .Select(charge => charge.Amount - charge.PaidAmount)
            .ToListAsync(cancellationToken);

        var outstanding = balances.Count == 0 ? (decimal?)null : balances.Sum();

        return Math.Max(0m, outstanding ?? user.Balance);
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

        var debtAmounts = await GetOutstandingBalancesAsync(users.Select(x => x.Id), cancellationToken);
        return users.Select(user => user.ToResponse(GetEffectiveDebtAmount(user, debtAmounts))).ToList();
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

        var debtAmounts = await GetOutstandingBalancesAsync(users.Select(x => x.Id), cancellationToken);
        return users.Select(user => user.ToLookup(GetEffectiveDebtAmount(user, debtAmounts))).ToList();
    }

    public async Task<UserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            throw new ConflictException("РљРѕСЂРёСЃС‚СѓРІР°С‡ Р· С‚Р°РєРёРј email СѓР¶Рµ С–СЃРЅСѓС”.");
        }

        var roleValue = Enum.Parse<UserRole>(request.Role, true);
        var role = await dbContext.Roles.FirstAsync(x => x.Name == roleValue, cancellationToken);
        Room? room = null;
        TariffPlan? tariff = null;

        if (roleValue != UserRole.Student && (request.RoomId.HasValue || request.TariffId.HasValue))
        {
            throw new ConflictException("Кімнату та тариф можна призначати лише студентам.");
        }

        if (roleValue == UserRole.Student && request.RoomId.HasValue)
        {
            room = await dbContext.Rooms
                .Include(x => x.Residents.Where(resident => resident.IsActive))
                .FirstOrDefaultAsync(x => x.Id == request.RoomId.Value, cancellationToken)
                ?? throw new NotFoundException("РљС–РјРЅР°С‚Сѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

            EnsureRoomCanHostStudent(room);
        }

        if (roleValue == UserRole.Student && request.TariffId.HasValue)
        {
            tariff = await dbContext.Tariffs.FirstOrDefaultAsync(x => x.Id == request.TariffId.Value, cancellationToken)
                ?? throw new NotFoundException("РўР°СЂРёС„ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");
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
                Title = $"РџСЂРѕР¶РёРІР°РЅРЅСЏ Р·Р° {DateTimeOffset.UtcNow:MMMM yyyy}",
                Amount = initialChargeAmount,
                Currency = "UAH",
                DueDate = DateTimeOffset.UtcNow.AddDays(7),
                CreatedBy = currentUser.UserId,
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        user.Role = role;
        await auditService.LogAsync(nameof(User), user.Id, "user.created", currentUser.UserId, new { user.Email, Role = role.Name }, cancellationToken);
        return user.ToResponse(roleValue == UserRole.Student ? initialChargeAmount : null);
    }

    public async Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        if (currentUser.UserId == userId)
        {
            throw new ConflictException("Неможливо видалити власний обліковий запис.");
        }

        var user = await dbContext.Users
            .Include(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundException("РљРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        var activeCharges = await dbContext.StudentCharges
            .IgnoreQueryFilters()
            .Where(x => x.IsActive && x.UserId == userId)
            .ToListAsync(cancellationToken);

        foreach (var charge in activeCharges)
        {
            charge.SoftDelete(currentUser.UserId);
        }

        user.Balance = 0m;
        user.SoftDelete(currentUser.UserId);
        user.IncreaseTokenVersion(currentUser.UserId);

        var sessions = await dbContext.UserSessions
            .IgnoreQueryFilters()
            .Where(x => x.UserId == userId && x.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var session in sessions)
        {
            session.IsRevoked = true;
            session.Touch(currentUser.UserId);
        }

        var refreshTokens = await dbContext.RefreshTokens
            .IgnoreQueryFilters()
            .Where(x => x.IsActive && x.Session.UserId == userId)
            .ToListAsync(cancellationToken);

        foreach (var token in refreshTokens)
        {
            token.RevokedAt ??= DateTimeOffset.UtcNow;
            token.Touch(currentUser.UserId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(User), user.Id, "user.deleted", currentUser.UserId, new { user.Email }, cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == request.UserId, cancellationToken)
            ?? throw new NotFoundException("РљРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

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
            throw new ForbiddenException("РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РїСЂР°РІ РґР»СЏ С†С–С”С— РґС–С—.");
        }
    }

    private async Task<Dictionary<Guid, decimal>> GetOutstandingBalancesAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken)
    {
        var ids = userIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var balances = await dbContext.StudentCharges
            .Where(charge => ids.Contains(charge.UserId))
            .Select(charge => new
            {
                charge.UserId,
                Outstanding = charge.Amount - charge.PaidAmount,
            })
            .ToListAsync(cancellationToken);

        return balances
            .GroupBy(charge => charge.UserId)
            .ToDictionary(
                group => group.Key,
                group => Math.Max(0m, group.Sum(charge => charge.Outstanding)));
    }

    private static decimal? GetEffectiveDebtAmount(User user, IReadOnlyDictionary<Guid, decimal> debtAmounts)
    {
        if (user.Role.Name != UserRole.Student)
        {
            return null;
        }

        return debtAmounts.TryGetValue(user.Id, out var debtAmount) ? debtAmount : user.Balance;
    }

    private static void EnsureRoomCanHostStudent(Room room)
    {
        if (room.IsUnderRepair)
        {
            throw new ConflictException("Не можна заселити студента в кімнату, що перебуває в ремонті.");
        }

        var occupied = room.Residents.Count(resident => resident.IsActive);
        if (occupied >= room.Capacity)
        {
            throw new ConflictException("У вибраній кімнаті вже немає вільних місць.");
        }
    }
}

internal static partial class MappingExtensions
{
    public static AuthenticatedUserResponse ToAuthenticatedUser(this User user, decimal? debtAmount = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, user.MustChangePassword, debtAmount);

    public static UserResponse ToResponse(this User user, decimal? debtAmount = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, debtAmount, user.MustChangePassword, user.IsActive);

    public static UserLookupResponse ToLookup(this User user, decimal? debtAmount = null) =>
        new(user.Id, user.FullName, user.Email, user.Phone, user.Role.Name.ToString(), user.RoomId, user.Room?.RoomNumber, debtAmount);

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
