using EDormitory.Application.Abstractions;
using EDormitory.Application.Common;
using EDormitory.Application.Contracts.Directories;
using EDormitory.Application.Contracts.Passes;
using EDormitory.Application.Contracts.Payments;
using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Billing;
using EDormitory.Domain.Common;
using EDormitory.Domain.Identity;
using EDormitory.Domain.Operations;
using EDormitory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EDormitory.Infrastructure.Services;

public sealed class MockPaymentProvider : IPaymentProvider
{
    public Task<PaymentProviderSession> CreatePaymentAsync(CreatePaymentProviderRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentProviderSession($"MOCK-{request.PaymentId:N}", new Uri($"https://mock-payments.local/checkout/{request.PaymentId:N}")));

    public Task<bool> VerifySignatureAsync(string payload, string? signature, CancellationToken cancellationToken = default) =>
        Task.FromResult(string.Equals(signature, "mock-signature", StringComparison.Ordinal));
}

public sealed class PassService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IAuditService auditService,
    IClock clock) : IPassService
{
    public async Task<IReadOnlyCollection<GuestPassResponse>> GetPassesAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Guard, UserRole.Admin);
        var query = dbContext.GuestPasses.Include(x => x.HostUser).AsQueryable();
        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.HostUserId == currentUser.UserId);
        }

        var items = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return items.Select(x => x.ToResponse(clock.UtcNow)).ToList();
    }

    public async Task<GuestPassResponse> CreatePassAsync(CreateGuestPassRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Admin);
        var host = await dbContext.Users.FirstAsync(x => x.Id == currentUser.UserId!.Value, cancellationToken);
        var pass = new GuestPass
        {
            HostUserId = host.Id,
            GuestFullName = request.GuestFullName.Trim(),
            GuestDocument = request.GuestDocument.Trim(),
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo,
            AccessCode = Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            CreatedBy = currentUser.UserId,
        };

        dbContext.GuestPasses.Add(pass);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(GuestPass), pass.Id, "pass.created", currentUser.UserId, new { pass.AccessCode }, cancellationToken);
        pass.HostUser = host;
        return pass.ToResponse(clock.UtcNow);
    }

    public async Task<PassLogResponse> ValidatePassAsync(ValidatePassRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Guard, UserRole.Admin);
        var pass = await dbContext.GuestPasses.Include(x => x.HostUser).FirstOrDefaultAsync(x => x.AccessCode == request.AccessCode, cancellationToken)
            ?? throw new NotFoundException("Перепустку не знайдено.");

        if (!pass.IsValidAt(clock.UtcNow))
        {
            throw new ConflictException("Перепустка недійсна або прострочена.");
        }

        var lastLog = await dbContext.PassLogs.Where(x => x.PassId == pass.Id).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        PassLog log;
        if (lastLog is null || lastLog.ExitTime.HasValue)
        {
            log = new PassLog
            {
                PassId = pass.Id,
                GuardUserId = currentUser.UserId!.Value,
                EntryTime = clock.UtcNow,
                Remarks = request.Remarks?.Trim(),
                CreatedBy = currentUser.UserId,
            };

            pass.Status = PassStatus.Entered;
            dbContext.PassLogs.Add(log);
        }
        else
        {
            lastLog.ExitTime = clock.UtcNow;
            lastLog.Remarks = request.Remarks?.Trim();
            lastLog.Touch(currentUser.UserId);
            pass.Status = PassStatus.Exited;
            log = lastLog;
        }

        pass.Touch(currentUser.UserId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(GuestPass), pass.Id, "pass.validated", currentUser.UserId, new { pass.Status }, cancellationToken);
        return await GetLogByIdAsync(log.Id, cancellationToken);
    }

    public async Task<IReadOnlyCollection<PassLogResponse>> GetLogsAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Guard, UserRole.Admin, UserRole.Student);
        var query = dbContext.PassLogs.Include(x => x.Pass).ThenInclude(x => x.HostUser).Include(x => x.GuardUser).AsQueryable();
        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.Pass.HostUserId == currentUser.UserId);
        }

        var items = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return items.Select(x => x.ToResponse()).ToList();
    }

    private async Task<PassLogResponse> GetLogByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var log = await dbContext.PassLogs.Include(x => x.Pass).Include(x => x.GuardUser).FirstAsync(x => x.Id == id, cancellationToken);
        return log.ToResponse();
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("Недостатньо прав для цієї дії.");
        }
    }
}

public sealed class PaymentService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IAuditService auditService,
    IPaymentProvider paymentProvider) : IPaymentService
{
    public async Task<IReadOnlyCollection<PaymentResponse>> GetPaymentsAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Accountant, UserRole.Admin);
        var query = dbContext.Payments
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .AsQueryable();
        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.UserId == currentUser.UserId);
        }

        var items = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return items.Select(x => x.ToResponse()).ToList();
    }

    public async Task<IReadOnlyCollection<ChargeResponse>> GetChargesAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Accountant, UserRole.Admin);
        var query = dbContext.StudentCharges
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .AsQueryable();
        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.UserId == currentUser.UserId);
        }
        else
        {
            query = query.Where(x => x.User.IsActive);
        }

        var items = await query.ToListAsync(cancellationToken);
        items = items.OrderByDescending(x => x.DueDate).ToList();
        return items.Select(x => x.ToResponse()).ToList();
    }

    public async Task<PaymentResponse> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Accountant, UserRole.Admin);
        var userId = currentUser.UserId!.Value;
        var payment = new Payment
        {
            UserId = userId,
            ChargeId = request.ChargeId,
            Amount = request.Amount,
            Currency = "UAH",
            PaymentMethod = request.PaymentMethod,
            ReceiptFileId = request.ReceiptFileId,
            CreatedBy = currentUser.UserId,
            IdempotencyKey = Guid.NewGuid().ToString("N"),
        };

        dbContext.Payments.Add(payment);
        await dbContext.SaveChangesAsync(cancellationToken);

        if (request.PaymentMethod == PaymentMethod.MockGateway)
        {
            var session = await paymentProvider.CreatePaymentAsync(new CreatePaymentProviderRequest(payment.Id, payment.Amount, payment.Currency, $"Dormitory payment {payment.Id}"), cancellationToken);
            payment.ProviderReference = session.ProviderReference;
            payment.Touch(currentUser.UserId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await auditService.LogAsync(nameof(Payment), payment.Id, "payment.created", currentUser.UserId, new { payment.Amount, payment.PaymentMethod }, cancellationToken);
        return await GetPaymentByIdAsync(payment.Id, cancellationToken);
    }

    public async Task<PaymentResponse> ConfirmPaymentAsync(Guid paymentId, ConfirmPaymentRequest request, CancellationToken cancellationToken = default)
    {
        var payment = await dbContext.Payments.FirstOrDefaultAsync(x => x.Id == paymentId, cancellationToken)
            ?? throw new NotFoundException("Платіж не знайдено.");

        EnsureCanConfirmPayment(payment);

        if (payment.TransactionStatus != PaymentStatus.Confirmed)
        {
            payment.Confirm(request.ExternalReceiptId, currentUser.UserId);
            var user = await dbContext.Users.FirstAsync(x => x.Id == payment.UserId, cancellationToken);
            user.Balance = Math.Max(0m, user.Balance - payment.Amount);
            user.Touch(currentUser.UserId);

            if (payment.ChargeId.HasValue)
            {
                var charge = await dbContext.StudentCharges.FirstOrDefaultAsync(x => x.Id == payment.ChargeId.Value, cancellationToken);
                charge?.ApplyPayment(payment.Amount, currentUser.UserId);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await auditService.LogAsync(nameof(Payment), payment.Id, "payment.confirmed", currentUser.UserId, new { payment.ExternalReceiptId }, cancellationToken);
        }

        return await GetPaymentByIdAsync(paymentId, cancellationToken);
    }

    private void EnsureCanConfirmPayment(Payment payment)
    {
        if (!currentUser.Role.HasValue || !currentUser.UserId.HasValue)
        {
            throw new ForbiddenException("Недостатньо прав для цієї дії.");
        }

        if (currentUser.Role is UserRole.Accountant or UserRole.Admin)
        {
            return;
        }

        if (currentUser.Role == UserRole.Student &&
            payment.UserId == currentUser.UserId.Value &&
            payment.PaymentMethod == PaymentMethod.MockGateway)
        {
            return;
        }

        throw new ForbiddenException("Недостатньо прав для цієї дії.");
    }

    public async Task HandleWebhookAsync(PaymentWebhookRequest request, CancellationToken cancellationToken = default)
    {
        if (!await paymentProvider.VerifySignatureAsync(request.Payload, request.Signature, cancellationToken))
        {
            throw new ForbiddenException("Недійсний підпис webhook.");
        }

        var payment = await dbContext.Payments.FirstOrDefaultAsync(x => x.Id == request.PaymentId, cancellationToken)
            ?? throw new NotFoundException("Платіж не знайдено.");

        if (payment.TransactionStatus == PaymentStatus.Confirmed)
        {
            return;
        }

        payment.Confirm(request.ExternalReceiptId, null);
        var user = await dbContext.Users.FirstAsync(x => x.Id == payment.UserId, cancellationToken);
        user.Balance = Math.Max(0m, user.Balance - payment.Amount);
        user.Touch(null);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(Payment), payment.Id, "payment.webhook.confirmed", null, new { request.ExternalReceiptId }, cancellationToken);
    }

    private async Task<PaymentResponse> GetPaymentByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var payment = await dbContext.Payments
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .FirstAsync(x => x.Id == id, cancellationToken);
        return payment.ToResponse();
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("Недостатньо прав для цієї дії.");
        }
    }
}

public sealed class DirectoryService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IAuditService auditService) : IDirectoryService
{
    public async Task<IReadOnlyCollection<TicketCategoryResponse>> GetTicketCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var items = await dbContext.TicketCategories.OrderBy(x => x.CategoryName).ToListAsync(cancellationToken);
        return items.Select(x => new TicketCategoryResponse(x.Id, x.CategoryName, x.SlaHours)).ToList();
    }

    public async Task<TicketCategoryResponse> CreateTicketCategoryAsync(UpsertTicketCategoryRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);
        var category = new TicketCategory
        {
            CategoryName = request.CategoryName.Trim(),
            SlaHours = request.SlaHours,
            CreatedBy = currentUser.UserId,
        };

        dbContext.TicketCategories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(TicketCategory), category.Id, "directory.ticket-category.created", currentUser.UserId, new { category.CategoryName }, cancellationToken);
        return new TicketCategoryResponse(category.Id, category.CategoryName, category.SlaHours);
    }

    public async Task<IReadOnlyCollection<RoleDirectoryResponse>> GetRolesAsync(CancellationToken cancellationToken = default)
    {
        var roles = await dbContext.Roles.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return roles.Select(x => new RoleDirectoryResponse(x.Id, x.Name.ToString(), x.Description)).ToList();
    }

    public async Task<IReadOnlyCollection<TariffResponse>> GetTariffsAsync(CancellationToken cancellationToken = default)
    {
        var tariffs = await dbContext.Tariffs.OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        return tariffs.Select(x => x.ToResponse()).ToList();
    }

    public async Task<TariffResponse> CreateTariffAsync(UpsertTariffRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);
        if (request.IsDefault)
        {
            await ClearDefaultTariffsAsync(cancellationToken);
        }

        var tariff = new TariffPlan
        {
            Name = request.Name.Trim(),
            MonthlyRate = request.MonthlyRate,
            Floor = request.Floor,
            IsDefault = request.IsDefault,
            CreatedBy = currentUser.UserId,
        };

        dbContext.Tariffs.Add(tariff);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(TariffPlan), tariff.Id, "directory.tariff.created", currentUser.UserId, new { tariff.Name, tariff.MonthlyRate }, cancellationToken);
        return tariff.ToResponse();
    }

    public async Task<TariffResponse> UpdateTariffAsync(Guid tariffId, UpsertTariffRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);
        var tariff = await dbContext.Tariffs.FirstOrDefaultAsync(x => x.Id == tariffId, cancellationToken)
            ?? throw new NotFoundException("Тариф не знайдено.");

        if (request.IsDefault)
        {
            await ClearDefaultTariffsAsync(cancellationToken, tariff.Id);
        }

        tariff.Name = request.Name.Trim();
        tariff.MonthlyRate = request.MonthlyRate;
        tariff.Floor = request.Floor;
        tariff.IsDefault = request.IsDefault;
        tariff.Touch(currentUser.UserId);

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(TariffPlan), tariff.Id, "directory.tariff.updated", currentUser.UserId, new { tariff.Name, tariff.MonthlyRate }, cancellationToken);
        return tariff.ToResponse();
    }

    public async Task DeleteTariffAsync(Guid tariffId, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Admin);
        var tariff = await dbContext.Tariffs.FirstOrDefaultAsync(x => x.Id == tariffId, cancellationToken)
            ?? throw new NotFoundException("РўР°СЂРёС„ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        if (tariff.IsDefault)
        {
            var hasFallbackDefault = await dbContext.Tariffs.AnyAsync(x => x.Id != tariff.Id && x.IsDefault, cancellationToken);
            if (!hasFallbackDefault)
            {
                throw new ConflictException("Неможливо видалити тариф за замовчуванням, доки не буде призначено інший.");
            }
        }

        tariff.SoftDelete(currentUser.UserId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(TariffPlan), tariff.Id, "directory.tariff.deleted", currentUser.UserId, new { tariff.Name }, cancellationToken);
    }

    private async Task ClearDefaultTariffsAsync(CancellationToken cancellationToken, Guid? exceptId = null)
    {
        var defaults = await dbContext.Tariffs.Where(x => x.IsDefault && (!exceptId.HasValue || x.Id != exceptId.Value)).ToListAsync(cancellationToken);
        foreach (var item in defaults)
        {
            item.IsDefault = false;
            item.Touch(currentUser.UserId);
        }
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("Недостатньо прав для цієї дії.");
        }
    }
}

public sealed class DataSeeder(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    IClock clock)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.EnsureCreatedAsync(cancellationToken);
        await EnsureSupplementalSchemaAsync(cancellationToken);

        if (!await dbContext.Roles.AnyAsync(cancellationToken))
        {
            dbContext.Roles.AddRange(Enum.GetValues<UserRole>().Select(role => new Role
            {
                Name = role,
                Description = $"{role} role",
                CreatedAt = clock.UtcNow,
            }));
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!await dbContext.Rooms.AnyAsync(cancellationToken))
        {
            dbContext.Rooms.AddRange(
            [
                new Room { RoomNumber = "101", Floor = 1, Capacity = 3, MonthlyRate = 3200m, CreatedAt = clock.UtcNow },
                new Room { RoomNumber = "102", Floor = 1, Capacity = 2, MonthlyRate = 3400m, CreatedAt = clock.UtcNow },
                new Room { RoomNumber = "201", Floor = 2, Capacity = 4, MonthlyRate = 3000m, CreatedAt = clock.UtcNow, IsUnderRepair = false },
            ]);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!await dbContext.TicketCategories.AnyAsync(cancellationToken))
        {
            dbContext.TicketCategories.AddRange(
            [
                new TicketCategory { CategoryName = "Електрика", SlaHours = 24, CreatedAt = clock.UtcNow },
                new TicketCategory { CategoryName = "Сантехніка", SlaHours = 12, CreatedAt = clock.UtcNow },
                new TicketCategory { CategoryName = "Меблі", SlaHours = 48, CreatedAt = clock.UtcNow },
            ]);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!await dbContext.Tariffs.AnyAsync(cancellationToken))
        {
            dbContext.Tariffs.AddRange(
            [
                new TariffPlan { Name = "Базовий", MonthlyRate = 3200m, Floor = 1, IsDefault = true, CreatedAt = clock.UtcNow },
                new TariffPlan { Name = "Комфорт", MonthlyRate = 3400m, Floor = 1, IsDefault = false, CreatedAt = clock.UtcNow },
                new TariffPlan { Name = "Стандарт+", MonthlyRate = 3000m, Floor = 2, IsDefault = false, CreatedAt = clock.UtcNow },
            ]);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!await dbContext.Users.AnyAsync(cancellationToken))
        {
            var roles = await dbContext.Roles.ToDictionaryAsync(x => x.Name, cancellationToken);
            var rooms = await dbContext.Rooms.OrderBy(x => x.RoomNumber).ToListAsync(cancellationToken);
            var users = new[]
            {
                new User { FullName = "Адміністратор Системи", Email = "admin@edormitory.local", Phone = "+380000000001", RoleId = roles[UserRole.Admin].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, CreatedAt = clock.UtcNow },
                new User { FullName = "Комендант Гуртожитку", Email = "commandant@edormitory.local", Phone = "+380000000002", RoleId = roles[UserRole.Commandant].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, CreatedAt = clock.UtcNow },
                new User { FullName = "Майстер Дільниці", Email = "master@edormitory.local", Phone = "+380000000003", RoleId = roles[UserRole.Master].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, CreatedAt = clock.UtcNow },
                new User { FullName = "Охоронець Зміни", Email = "guard@edormitory.local", Phone = "+380000000004", RoleId = roles[UserRole.Guard].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, CreatedAt = clock.UtcNow },
                new User { FullName = "Бухгалтер Гуртожитку", Email = "accountant@edormitory.local", Phone = "+380000000005", RoleId = roles[UserRole.Accountant].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, CreatedAt = clock.UtcNow },
                new User { FullName = "Студент Петро Іваненко", Email = "student@edormitory.local", Phone = "+380000000006", RoleId = roles[UserRole.Student].Id, RoomId = rooms[0].Id, PasswordHash = passwordHasher.Hash("ChangeMe123!"), MustChangePassword = false, Balance = 3200m, CreatedAt = clock.UtcNow },
            };

            dbContext.Users.AddRange(users);
            await dbContext.SaveChangesAsync(cancellationToken);

            var student = users.Single(x => x.Email == "student@edormitory.local");
            dbContext.StudentCharges.Add(new StudentCharge
            {
                UserId = student.Id,
                Title = "Проживання за березень",
                Amount = 3200m,
                Currency = "UAH",
                DueDate = clock.UtcNow.AddDays(7),
                CreatedAt = clock.UtcNow,
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task EnsureSupplementalSchemaAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "Tariffs" (
                "Id" uuid NOT NULL,
                "Name" character varying(120) NOT NULL,
                "MonthlyRate" numeric(18,2) NOT NULL,
                "Floor" integer NULL,
                "IsDefault" boolean NOT NULL DEFAULT FALSE,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "CreatedBy" uuid NULL,
                "UpdatedBy" uuid NULL,
                "IsActive" boolean NOT NULL DEFAULT TRUE,
                CONSTRAINT "PK_Tariffs" PRIMARY KEY ("Id")
            );
            """,
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "NotificationStates" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "LastReadAt" timestamp with time zone NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "CreatedBy" uuid NULL,
                "UpdatedBy" uuid NULL,
                "IsActive" boolean NOT NULL DEFAULT TRUE,
                CONSTRAINT "PK_NotificationStates" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_NotificationStates_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_NotificationStates_UserId" ON "NotificationStates" ("UserId");
            """,
            cancellationToken);
    }
}

internal static partial class MappingExtensions
{
    public static GuestPassResponse ToResponse(this GuestPass pass, DateTimeOffset now)
    {
        var status = pass.Status;
        if (status is not PassStatus.Exited && status is not PassStatus.Rejected && pass.ValidTo < now)
        {
            status = PassStatus.Expired;
        }

        return new(pass.Id, pass.GuestFullName, pass.GuestDocument, pass.HostUser.FullName, pass.AccessCode, status.ToString(), pass.ValidFrom, pass.ValidTo);
    }

    public static PassLogResponse ToResponse(this PassLog log) =>
        new(log.Id, log.PassId, log.Pass.GuestFullName, log.GuardUser.FullName, log.EntryTime, log.ExitTime, log.Remarks);

    public static PaymentResponse ToResponse(this Payment payment) =>
        new(payment.Id, payment.UserId, payment.User.FullName, payment.Amount, payment.Currency, payment.PaymentMethod.ToString(), payment.TransactionStatus.ToString(), payment.ExternalReceiptId, payment.PaidAt, payment.ReceiptFileId, payment.ChargeId);

    public static ChargeResponse ToResponse(this StudentCharge charge) =>
        new(charge.Id, charge.Title, charge.Amount, charge.PaidAmount, charge.Currency, charge.DueDate, charge.IsSettled);

    public static TariffResponse ToResponse(this TariffPlan tariff) =>
        new(tariff.Id, tariff.Name, tariff.MonthlyRate, tariff.Floor, tariff.IsDefault);
}
