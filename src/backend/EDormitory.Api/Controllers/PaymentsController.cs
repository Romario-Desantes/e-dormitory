using EDormitory.Application.Contracts.Payments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public sealed class PaymentsController(IPaymentService paymentService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<PaymentResponse>>> GetPayments(CancellationToken cancellationToken) =>
        Ok(await paymentService.GetPaymentsAsync(cancellationToken));

    [HttpGet("charges")]
    public async Task<ActionResult<IReadOnlyCollection<ChargeResponse>>> GetCharges(CancellationToken cancellationToken) =>
        Ok(await paymentService.GetChargesAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<PaymentResponse>> CreatePayment([FromBody] CreatePaymentRequest request, CancellationToken cancellationToken) =>
        Ok(await paymentService.CreatePaymentAsync(request, cancellationToken));

    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<PaymentResponse>> ConfirmPayment(Guid id, [FromBody] ConfirmPaymentRequest request, CancellationToken cancellationToken) =>
        Ok(await paymentService.ConfirmPaymentAsync(id, request, cancellationToken));

    [HttpPost("webhook/mock")]
    [AllowAnonymous]
    public async Task<IActionResult> MockWebhook([FromBody] PaymentWebhookRequest request, CancellationToken cancellationToken)
    {
        await paymentService.HandleWebhookAsync(request, cancellationToken);
        return NoContent();
    }
}
