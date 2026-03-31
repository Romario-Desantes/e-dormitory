using EDormitory.Domain.Common;
using FluentValidation;

namespace EDormitory.Application.Contracts.Tickets;

public sealed record CreateTicketRequest(
    Guid CategoryId,
    string Title,
    string Description,
    TicketPriority Priority,
    IReadOnlyCollection<Guid>? AttachmentIds);

public sealed record UpdateTicketStatusRequest(TicketStatus Status, string? MasterNotes);

public sealed record TicketResponse(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string RoomNumber,
    string Status,
    string Priority,
    string CreatedBy,
    string? ContactPhone,
    string? AssignedTo,
    string? MasterNotes,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt,
    IReadOnlyCollection<Guid> AttachmentIds);

public sealed record TicketAttachmentResponse(
    Guid Id,
    string FileName,
    string ContentType,
    long Size,
    string PreviewUrl);

public sealed record TicketDetailResponse(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string RoomNumber,
    string Status,
    string Priority,
    string CreatedBy,
    string? ContactPhone,
    string? AssignedTo,
    string? MasterNotes,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt,
    IReadOnlyCollection<TicketAttachmentResponse> Attachments);

public sealed class CreateTicketRequestValidator : AbstractValidator<CreateTicketRequest>
{
    public CreateTicketRequestValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(160);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.AttachmentIds).Must(ids => ids is null || ids.Count <= 5);
    }
}

public sealed class UpdateTicketStatusRequestValidator : AbstractValidator<UpdateTicketStatusRequest>
{
    public UpdateTicketStatusRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
    }
}

public interface ITicketService
{
    Task<IReadOnlyCollection<TicketResponse>> GetTicketsAsync(CancellationToken cancellationToken = default);
    Task<TicketDetailResponse> GetTicketDetailAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<TicketResponse> CreateTicketAsync(CreateTicketRequest request, CancellationToken cancellationToken = default);
    Task<TicketResponse> UpdateStatusAsync(Guid ticketId, UpdateTicketStatusRequest request, CancellationToken cancellationToken = default);
}
