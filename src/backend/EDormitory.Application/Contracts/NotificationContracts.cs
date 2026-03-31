namespace EDormitory.Application.Contracts.Notifications;

public sealed record NotificationResponse(
    Guid Id,
    string Title,
    string Description,
    string Tone,
    DateTimeOffset CreatedAt);

public interface INotificationService
{
    Task<IReadOnlyCollection<NotificationResponse>> GetNotificationsAsync(CancellationToken cancellationToken = default);
}
