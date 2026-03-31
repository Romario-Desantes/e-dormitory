using EDormitory.Domain.Common;

namespace EDormitory.Application.Abstractions;

public interface ICurrentUserContext
{
    Guid? UserId { get; }
    Guid? SessionId { get; }
    UserRole? Role { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
}

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface ITokenService
{
    string CreateAccessToken(TokenDescriptor descriptor);
    string CreateRefreshToken();
    string HashRefreshToken(string token);
}

public sealed record TokenDescriptor(
    Guid UserId,
    Guid SessionId,
    string Email,
    UserRole Role,
    int TokenVersion,
    DateTimeOffset ExpiresAt);

public interface IFileStorage
{
    Task<StoredFileResult> UploadAsync(
        string key,
        Stream stream,
        string contentType,
        CancellationToken cancellationToken = default);

    Task<Stream> OpenReadAsync(
        string key,
        CancellationToken cancellationToken = default);
}

public sealed record StoredFileResult(string StorageKey, string Checksum);

public interface IAuditService
{
    Task LogAsync(string entityName, Guid? entityId, string action, Guid? userId, object payload, CancellationToken cancellationToken = default);
    Task LogSecurityEventAsync(Guid? userId, string eventType, string details, string? ipAddress, string? userAgent, CancellationToken cancellationToken = default);
}

public interface IPaymentProvider
{
    Task<PaymentProviderSession> CreatePaymentAsync(CreatePaymentProviderRequest request, CancellationToken cancellationToken = default);
    Task<bool> VerifySignatureAsync(string payload, string? signature, CancellationToken cancellationToken = default);
}

public sealed record CreatePaymentProviderRequest(Guid PaymentId, decimal Amount, string Currency, string Description);
public sealed record PaymentProviderSession(string ProviderReference, Uri CheckoutUrl);
