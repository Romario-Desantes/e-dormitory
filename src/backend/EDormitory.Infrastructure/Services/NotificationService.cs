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
    public async Task<IReadOnlyCollection<NotificationResponse>> GetNotificationsAsync(CancellationToken cancellationToken = default)
    {
        if (!currentUser.UserId.HasValue || !currentUser.Role.HasValue)
        {
            throw new ForbiddenException("Користувач не авторизований.");
        }

        return currentUser.Role.Value switch
        {
            UserRole.Student => await GetStudentNotificationsAsync(currentUser.UserId.Value, cancellationToken),
            UserRole.Commandant => await GetCommandantNotificationsAsync(cancellationToken),
            UserRole.Master => await GetMasterNotificationsAsync(cancellationToken),
            UserRole.Guard => await GetGuardNotificationsAsync(cancellationToken),
            UserRole.Accountant => await GetAccountantNotificationsAsync(cancellationToken),
            UserRole.Admin => await GetAdminNotificationsAsync(cancellationToken),
            _ => [],
        };
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetStudentNotificationsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var notifications = new List<NotificationResponse>();

        var latestTickets = await dbContext.RepairTickets
            .Include(x => x.Category)
            .Where(x => x.CreatedByUserId == userId)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .Take(3)
            .ToListAsync(cancellationToken);

        notifications.AddRange(latestTickets.Select(ticket =>
            new NotificationResponse(ticket.Id, "Статус заявки оновлено", $"{ticket.Category.CategoryName}: {ticket.Title}", ToneForTicket(ticket.Status), ticket.UpdatedAt ?? ticket.CreatedAt)));

        var latestPasses = await dbContext.GuestPasses
            .Where(x => x.HostUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(2)
            .ToListAsync(cancellationToken);

        notifications.AddRange(latestPasses.Select(pass =>
            new NotificationResponse(pass.Id, "Гостьова перепустка", $"Гість {pass.GuestFullName}, код {pass.AccessCode}", "sky", pass.CreatedAt)));

        var latestPayments = await dbContext.Payments
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(2)
            .ToListAsync(cancellationToken);

        notifications.AddRange(latestPayments.Select(payment =>
            new NotificationResponse(payment.Id, "Платіж у системі", $"{payment.Amount:0.00} {payment.Currency} · {payment.TransactionStatus}", payment.TransactionStatus == PaymentStatus.Confirmed ? "emerald" : "amber", payment.CreatedAt)));

        return notifications.OrderByDescending(x => x.CreatedAt).Take(6).ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetCommandantNotificationsAsync(CancellationToken cancellationToken)
    {
        var relocations = await dbContext.RelocationRequests
            .Include(x => x.User)
            .Include(x => x.ToRoom)
            .OrderByDescending(x => x.CreatedAt)
            .Take(3)
            .ToListAsync(cancellationToken);

        var violations = await dbContext.Violations
            .Include(x => x.User)
            .OrderByDescending(x => x.CreatedAt)
            .Take(3)
            .ToListAsync(cancellationToken);

        return relocations.Select(x => new NotificationResponse(x.Id, "Запит на переселення", $"{x.User.FullName} → {x.ToRoom.RoomNumber}", "sky", x.CreatedAt))
            .Concat(violations.Select(x => new NotificationResponse(x.Id, "Нове порушення", $"{x.User.FullName}: {x.Description}", "rose", x.CreatedAt)))
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetMasterNotificationsAsync(CancellationToken cancellationToken)
    {
        var tickets = await dbContext.RepairTickets
            .Include(x => x.Room)
            .Include(x => x.Category)
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .ToListAsync(cancellationToken);

        return tickets.Select(ticket =>
            new NotificationResponse(ticket.Id, $"Заявка: кімната {ticket.Room.RoomNumber}", $"{ticket.Category.CategoryName} · {ticket.Title}", ToneForTicket(ticket.Status), ticket.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetGuardNotificationsAsync(CancellationToken cancellationToken)
    {
        var logs = await dbContext.PassLogs
            .Include(x => x.Pass)
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .ToListAsync(cancellationToken);

        return logs.Select(log =>
            new NotificationResponse(log.Id, "Журнал проходу", $"{log.Pass.GuestFullName} · {(log.ExitTime.HasValue ? "вихід" : "вхід")}", "emerald", log.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetAccountantNotificationsAsync(CancellationToken cancellationToken)
    {
        var payments = await dbContext.Payments
            .Include(x => x.User)
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .ToListAsync(cancellationToken);

        return payments.Select(payment =>
            new NotificationResponse(payment.Id, "Платіж очікує дії", $"{payment.User.FullName} · {payment.Amount:0.00} {payment.Currency}", payment.TransactionStatus == PaymentStatus.Confirmed ? "emerald" : "amber", payment.CreatedAt))
            .ToList();
    }

    private async Task<IReadOnlyCollection<NotificationResponse>> GetAdminNotificationsAsync(CancellationToken cancellationToken)
    {
        var security = await dbContext.SecurityEvents
            .OrderByDescending(x => x.CreatedAt)
            .Take(6)
            .ToListAsync(cancellationToken);

        return security.Select(item =>
            new NotificationResponse(item.Id, item.EventType, item.Details, "slate", item.CreatedAt))
            .ToList();
    }

    private static string ToneForTicket(TicketStatus status) =>
        status switch
        {
            TicketStatus.Completed => "emerald",
            TicketStatus.InProgress => "sky",
            _ => "amber",
        };
}
