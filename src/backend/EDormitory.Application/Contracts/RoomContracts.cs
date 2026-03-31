using FluentValidation;

namespace EDormitory.Application.Contracts.Rooms;

public sealed record RoomResponse(Guid Id, string RoomNumber, int Floor, int Capacity, int Occupied, decimal MonthlyRate, bool IsUnderRepair);

public sealed record RoomOccupancyResponse(int Floor, IReadOnlyCollection<RoomResponse> Rooms);

public sealed record RoomResidentResponse(Guid Id, string FullName, string Phone, string Role, decimal Balance);

public sealed record RoomDetailResponse(
    Guid Id,
    string RoomNumber,
    int Floor,
    int Capacity,
    int Occupied,
    decimal MonthlyRate,
    bool IsUnderRepair,
    IReadOnlyCollection<RoomResidentResponse> Residents);

public sealed record CreateRelocationRequest(Guid ToRoomId, string Reason);

public sealed record ReviewRelocationRequest(RelocationDecision Decision, string? ReviewComment);

public enum RelocationDecision
{
    Approve = 1,
    Reject = 2,
}

public sealed record RelocationRequestResponse(
    Guid Id,
    Guid UserId,
    string StudentName,
    Guid FromRoomId,
    string FromRoomNumber,
    Guid ToRoomId,
    string ToRoomNumber,
    string Reason,
    string Status,
    string? ReviewComment);

public sealed record CreateViolationRequest(Guid UserId, Guid? RoomId, string Severity, string Description, DateTimeOffset OccurredAt);

public sealed record ViolationResponse(
    Guid Id,
    Guid UserId,
    string StudentName,
    Guid? RoomId,
    string? RoomNumber,
    string Severity,
    string Description,
    string RecordedBy,
    DateTimeOffset OccurredAt);

public sealed class CreateRelocationRequestValidator : AbstractValidator<CreateRelocationRequest>
{
    public CreateRelocationRequestValidator()
    {
        RuleFor(x => x.ToRoomId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

public sealed class ReviewRelocationRequestValidator : AbstractValidator<ReviewRelocationRequest>
{
    public ReviewRelocationRequestValidator()
    {
        RuleFor(x => x.Decision).IsInEnum();
    }
}

public sealed class CreateViolationRequestValidator : AbstractValidator<CreateViolationRequest>
{
    public CreateViolationRequestValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Severity).NotEmpty();
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
    }
}

public interface IRoomService
{
    Task<IReadOnlyCollection<RoomResponse>> GetRoomsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<RoomOccupancyResponse>> GetOccupancyAsync(CancellationToken cancellationToken = default);
    Task<RoomDetailResponse> GetRoomDetailAsync(Guid roomId, CancellationToken cancellationToken = default);
    Task<RelocationRequestResponse> CreateRelocationRequestAsync(CreateRelocationRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<RelocationRequestResponse>> GetRelocationRequestsAsync(CancellationToken cancellationToken = default);
    Task<RelocationRequestResponse> ReviewRelocationRequestAsync(Guid requestId, ReviewRelocationRequest request, CancellationToken cancellationToken = default);
    Task<ViolationResponse> CreateViolationAsync(CreateViolationRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ViolationResponse>> GetViolationsAsync(CancellationToken cancellationToken = default);
}
