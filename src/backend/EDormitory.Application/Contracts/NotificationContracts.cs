namespace EDormitory.Application.Contracts.Notifications;

public sealed record NotificationResponse(
    Guid Id,
    string Title,
    string Description,
    string Tone,
    DateTimeOffset CreatedAt);

public sealed record NotificationFeedResponse(
    IReadOnlyCollection<NotificationResponse> Items,
    int UnreadCount);

public interface INotificationService
{
    Task<NotificationFeedResponse> GetNotificationsAsync(CancellationToken cancellationToken = default);
    Task MarkNotificationsReadAsync(CancellationToken cancellationToken = default);
}
