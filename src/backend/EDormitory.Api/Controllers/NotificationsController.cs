using EDormitory.Application.Contracts.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<NotificationResponse>>> GetNotifications(CancellationToken cancellationToken) =>
        Ok(await notificationService.GetNotificationsAsync(cancellationToken));
}
