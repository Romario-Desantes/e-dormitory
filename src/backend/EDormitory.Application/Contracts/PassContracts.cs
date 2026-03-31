using FluentValidation;

namespace EDormitory.Application.Contracts.Passes;

public sealed record CreateGuestPassRequest(string GuestFullName, string GuestDocument, DateTimeOffset ValidFrom, DateTimeOffset ValidTo);

public sealed record ValidatePassRequest(string AccessCode, string? Remarks);

public sealed record GuestPassResponse(
    Guid Id,
    string GuestFullName,
    string GuestDocument,
    string HostName,
    string AccessCode,
    string Status,
    DateTimeOffset ValidFrom,
    DateTimeOffset ValidTo);

public sealed record PassLogResponse(
    Guid Id,
    Guid PassId,
    string GuestFullName,
    string GuardName,
    DateTimeOffset? EntryTime,
    DateTimeOffset? ExitTime,
    string? Remarks);

public sealed class CreateGuestPassRequestValidator : AbstractValidator<CreateGuestPassRequest>
{
    public CreateGuestPassRequestValidator()
    {
        RuleFor(x => x.GuestFullName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.GuestDocument).NotEmpty().MaximumLength(64);
        RuleFor(x => x.ValidTo).GreaterThan(x => x.ValidFrom);
    }
}

public sealed class ValidatePassRequestValidator : AbstractValidator<ValidatePassRequest>
{
    public ValidatePassRequestValidator()
    {
        RuleFor(x => x.AccessCode).NotEmpty().MaximumLength(64);
    }
}

public interface IPassService
{
    Task<IReadOnlyCollection<GuestPassResponse>> GetPassesAsync(CancellationToken cancellationToken = default);
    Task<GuestPassResponse> CreatePassAsync(CreateGuestPassRequest request, CancellationToken cancellationToken = default);
    Task<PassLogResponse> ValidatePassAsync(ValidatePassRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<PassLogResponse>> GetLogsAsync(CancellationToken cancellationToken = default);
}
