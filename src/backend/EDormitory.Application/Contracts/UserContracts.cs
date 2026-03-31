using FluentValidation;

namespace EDormitory.Application.Contracts.Users;

public sealed record CreateUserRequest(
    string FullName,
    string Email,
    string Phone,
    string Role,
    Guid? RoomId,
    Guid? TariffId);

public sealed record ResetPasswordRequest(Guid UserId, string NewPassword);

public sealed record UserResponse(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string Role,
    Guid? RoomId,
    decimal Balance,
    bool MustChangePassword,
    bool IsActive);

public sealed record UserLookupResponse(
    Guid Id,
    string FullName,
    string Email,
    string Phone,
    string Role,
    Guid? RoomId,
    string? RoomNumber,
    decimal Balance);

public sealed class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Role).NotEmpty();
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.NewPassword).MinimumLength(10);
    }
}

public interface IUserService
{
    Task<IReadOnlyCollection<UserResponse>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<UserLookupResponse>> SearchUsersAsync(string? role, string? query, CancellationToken cancellationToken = default);
    Task<UserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
