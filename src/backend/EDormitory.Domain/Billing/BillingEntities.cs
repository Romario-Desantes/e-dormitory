using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Common;

namespace EDormitory.Domain.Billing;

public sealed class StudentCharge : AuditableEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "UAH";
    public decimal PaidAmount { get; set; }
    public DateTimeOffset DueDate { get; set; }
    public bool IsSettled { get; set; }

    public void ApplyPayment(decimal amount, Guid? userId = null)
    {
        PaidAmount += amount;
        IsSettled = PaidAmount >= Amount;
        Touch(userId);
    }
}

public sealed class TariffPlan : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal MonthlyRate { get; set; }
    public int? Floor { get; set; }
    public bool IsDefault { get; set; }
}

public sealed class Payment : AuditableEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid? ChargeId { get; set; }
    public StudentCharge? Charge { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "UAH";
    public PaymentMethod PaymentMethod { get; set; }
    public string? ExternalReceiptId { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public PaymentStatus TransactionStatus { get; set; } = PaymentStatus.Pending;
    public string? ProviderReference { get; set; }
    public Guid? ReceiptFileId { get; set; }
    public string? IdempotencyKey { get; set; }

    public void Confirm(string? externalReceiptId, Guid? userId = null)
    {
        TransactionStatus = PaymentStatus.Confirmed;
        ExternalReceiptId = externalReceiptId;
        PaidAt = DateTimeOffset.UtcNow;
        Touch(userId);
    }
}

public sealed class AuditLog : AuditableEntity
{
    public string EntityName { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid? UserId { get; set; }
    public string PayloadJson { get; set; } = string.Empty;
}

public sealed class SecurityEvent : AuditableEntity
{
    public Guid? UserId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
