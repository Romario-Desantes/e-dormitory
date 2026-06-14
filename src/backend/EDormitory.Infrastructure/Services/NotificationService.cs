using EDormitory.Application.Abstractions;
using EDormitory.Application.Common;
using EDormitory.Application.Contracts.Notifications;
using EDormitory.Domain.Common;
using EDormitory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EDormitory.Infrastructure.Services;

public sealed class NotificationService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser) : INotificationService
{
    public async Task<NotificationFeedResponse> GetNotificationsAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.UserId.HasValue || !currentUser.Role.HasValue)
        {
            throw new ForbiddenException("Користувач не авторизований.");
        }

        var items = currentUser.Role.Value switch
        {
            UserRole.Student => await GetStudentNotificationsAsync(currentUser.UserId.Value, cancellationToken),
            UserRole.Commandant => await GetCommandantNotificationsAsync(cancellationToken),
            UserRole.Master => await GetMasterNotificationsAsync(cancellationToken),
            UserRole.Guard => await GetGuardNotificationsAsync(cancellationToken),
            UserRole.Accountant => await GetAccountantNotificationsAsync(cancellationToken),
            UserRole.Admin => await GetAdminNotificationsAsync(cancellationToken),
            _ => [],
        };

        return new NotificationFeedResponse(items, items.Count);
    }

    public Task MarkNotificationsReadAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.UserId.HasValue)
        {
            throw new ForbiddenException("Користувач не авторизований.");
        }

        return Task.CompletedTask;
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetStudentNotificationsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var notifications = new List<NotificationResponse>();

        var latestTickets = (await dbContext.RepairTickets
                .Where(x => x.CreatedByUserId == userId)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .Take(3)
            .ToList();

        notifications.AddRange(latestTickets.Select(ticket =>
            new NotificationResponse(ticket.Id, "Статус заявки оновлено", $"{ticket.Category}: {ticket.Title}", ToneForTicket(ticket.Status), ticket.UpdatedAt ?? ticket.CreatedAt)));

        var latestPasses = (await dbContext.GuestPasses
                .Where(x => x.HostUserId == userId)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(2)
            .ToList();

        notifications.AddRange(latestPasses.Select(pass =>
            new NotificationResponse(pass.Id, "Гостьова перепустка", $"Гість {pass.GuestFullName}, код {pass.AccessCode}", "sky", pass.CreatedAt)));

        var latestPayments = (await dbContext.Payments
                .Where(x => x.UserId == userId)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(2)
            .ToList();

        notifications.AddRange(latestPayments.Select(payment =>
            new NotificationResponse(payment.Id, "Платіж у системі", $"{payment.Amount:0.00} {payment.Currency} · {payment.TransactionStatus}", payment.TransactionStatus == PaymentStatus.Confirmed ? "emerald" : "amber", payment.CreatedAt)));

        var latestRelocations = (await dbContext.RelocationRequests
                .Where(x => x.UserId == userId)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .Take(2)
            .ToList();

        notifications.AddRange(latestRelocations.Select(relocation =>
            new NotificationResponse(relocation.Id, "Переселення", relocation.Status == RelocationStatus.Pending ? "Заяву на переселення надіслано коменданту." : $"Статус: {relocation.Status}", relocation.Status == RelocationStatus.Approved ? "emerald" : relocation.Status == RelocationStatus.Rejected ? "rose" : "sky", relocation.UpdatedAt ?? relocation.CreatedAt)));

        var latestViolations = (await dbContext.Violations
                .IgnoreQueryFilters()
                .Where(x => x.IsActive && x.UserId == userId)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(3)
            .ToList();

        notifications.AddRange(latestViolations.Select(violation =>
            new NotificationResponse(violation.Id, "Зафіксовано порушення", violation.Description, ToneForViolation(violation.Severity), violation.CreatedAt)));

        return notifications
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetCommandantNotificationsAsync(CancellationToken cancellationToken)
    {
        var relocations = (await dbContext.RelocationRequests
                .IgnoreQueryFilters()
                .Where(x => x.IsActive)
                .Include(x => x.User)
                .Include(x => x.ToRoom)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(3)
            .ToList();

        var violations = (await dbContext.Violations
                .IgnoreQueryFilters()
                .Where(x => x.IsActive)
                .Include(x => x.User)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(3)
            .ToList();

        return relocations.Select(x => new NotificationResponse(x.Id, "Запит на переселення", $"{x.User.FullName} -> {x.ToRoom.RoomNumber}", "sky", x.CreatedAt))
            .Concat(violations.Select(x => new NotificationResponse(x.Id, "Нове порушення", $"{x.User.FullName}: {x.Description}", ToneForViolation(x.Severity), x.CreatedAt)))
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetMasterNotificationsAsync(CancellationToken cancellationToken)
    {
        var tickets = (await dbContext.RepairTickets
                .Include(x => x.Room)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        return tickets.Select(ticket =>
            new NotificationResponse(ticket.Id, $"Заявка: кімната {ticket.Room.RoomNumber}", $"{ticket.Category} · {ticket.Title}", ToneForTicket(ticket.Status), ticket.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetGuardNotificationsAsync(CancellationToken cancellationToken)
    {
        var logs = (await dbContext.PassLogs
                .Include(x => x.Pass)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        return logs.Select(log =>
            new NotificationResponse(log.Id, "Журнал проходу", $"{log.Pass.GuestFullName} · {(log.ExitTime.HasValue ? "вихід" : "вхід")}", "emerald", log.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetAccountantNotificationsAsync(CancellationToken cancellationToken)
    {
        var payments = (await dbContext.Payments
                .IgnoreQueryFilters()
                .Where(x => x.IsActive)
                .Include(x => x.User)
                .ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        return payments.Select(payment =>
            new NotificationResponse(payment.Id, "Платіж очікує дії", $"{payment.User.FullName} · {payment.Amount:0.00} {payment.Currency}", payment.TransactionStatus == PaymentStatus.Confirmed ? "emerald" : "amber", payment.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetAdminNotificationsAsync(CancellationToken cancellationToken)
    {
        var sessions = (await dbContext.UserSessions.ToListAsync(cancellationToken))
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        return sessions.Select(item =>
            new NotificationResponse(item.Id, "Сесія користувача", item.IpAddress ?? "IP не вказано", "slate", item.CreatedAt))
            .ToList();
    }

    private static string ToneForTicket(TicketStatus status) =>
        status switch
        {
            TicketStatus.Completed => "emerald",
            TicketStatus.InProgress => "sky",
            _ => "amber",
        };

    private static string ToneForViolation(ViolationSeverity severity) =>
        severity switch
        {
            ViolationSeverity.High => "rose",
            ViolationSeverity.Medium => "amber",
            _ => "sky",
        };
}
