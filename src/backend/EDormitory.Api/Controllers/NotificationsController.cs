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
    public async Task<ActionResult<NotificationFeedResponse>> GetNotifications(CancellationToken cancellationToken) =>
        Ok(await notificationService.GetNotificationsAsync(cancellationToken));

    [HttpPost("read")]
    public async Task<IActionResult> MarkRead(CancellationToken cancellationToken)
    {
        await notificationService.MarkNotificationsReadAsync(cancellationToken);
        return NoContent();
    }
}
