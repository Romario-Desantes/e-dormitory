using EDormitory.Domain.Common;
using FluentValidation;

namespace EDormitory.Application.Contracts.Payments;

public sealed record CreatePaymentRequest(Guid? ChargeId, decimal Amount, PaymentMethod PaymentMethod);

public sealed record ConfirmPaymentRequest(string? ExternalReceiptId);

public sealed record PaymentResponse(
    Guid Id,
    Guid UserId,
    string UserName,
    decimal Amount,
    string Currency,
    string PaymentMethod,
    string Status,
    string? ExternalReceiptId,
    DateTimeOffset? PaidAt,
    Guid? ChargeId);

public sealed record ChargeResponse(Guid Id, string Title, decimal Amount, decimal PaidAmount, string Currency, DateTimeOffset DueDate, bool IsSettled);

public sealed record PaymentWebhookRequest(Guid PaymentId, string Payload, string? Signature, string ExternalReceiptId);

public sealed class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequest>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}

public sealed class ConfirmPaymentRequestValidator : AbstractValidator<ConfirmPaymentRequest>
{
    public ConfirmPaymentRequestValidator()
    {
        RuleFor(x => x.ExternalReceiptId).MaximumLength(120);
    }
}

public sealed class PaymentWebhookRequestValidator : AbstractValidator<PaymentWebhookRequest>
{
    public PaymentWebhookRequestValidator()
    {
        RuleFor(x => x.PaymentId).NotEmpty();
        RuleFor(x => x.Payload).NotEmpty();
        RuleFor(x => x.ExternalReceiptId).NotEmpty();
    }
}

public interface IPaymentService
{
    Task<IReadOnlyCollection<PaymentResponse>> GetPaymentsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ChargeResponse>> GetChargesAsync(CancellationToken cancellationToken = default);
    Task<PaymentResponse> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken cancellationToken = default);
    Task<PaymentResponse> ConfirmPaymentAsync(Guid paymentId, ConfirmPaymentRequest request, CancellationToken cancellationToken = default);
    Task HandleWebhookAsync(PaymentWebhookRequest request, CancellationToken cancellationToken = default);
}
