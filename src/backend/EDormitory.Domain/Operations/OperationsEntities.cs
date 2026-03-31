using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Common;

namespace EDormitory.Domain.Operations;

public sealed class TicketCategory : AuditableEntity
{
    public string CategoryName { get; set; } = string.Empty;
    public int SlaHours { get; set; }
}

public sealed class RepairTicket : AuditableEntity
{
    public Guid CategoryId { get; set; }
    public TicketCategory Category { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }
    public Guid RoomId { get; set; }
    public Room Room { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; } = TicketPriority.Medium;
    public TicketStatus Status { get; set; } = TicketStatus.New;
    public string? MasterNotes { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }

    public void Start(Guid assignedToUserId, Guid? userId = null)
    {
        AssignedToUserId = assignedToUserId;
        Status = TicketStatus.InProgress;
        Touch(userId);
    }

    public void Complete(string? notes, Guid? userId = null)
    {
        Status = TicketStatus.Completed;
        MasterNotes = notes;
        ResolvedAt = DateTimeOffset.UtcNow;
        Touch(userId);
    }
}

public sealed class GuestPass : AuditableEntity
{
    public Guid HostUserId { get; set; }
    public User HostUser { get; set; } = null!;
    public string GuestFullName { get; set; } = string.Empty;
    public string GuestDocument { get; set; } = string.Empty;
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset ValidTo { get; set; }
    public PassStatus Status { get; set; } = PassStatus.Approved;
    public string AccessCode { get; set; } = string.Empty;
    public ICollection<PassLog> Logs { get; set; } = new List<PassLog>();

    public bool IsValidAt(DateTimeOffset now) => Status is not PassStatus.Rejected && ValidFrom <= now && ValidTo >= now;
}

public sealed class PassLog : AuditableEntity
{
    public Guid PassId { get; set; }
    public GuestPass Pass { get; set; } = null!;
    public Guid GuardUserId { get; set; }
    public User GuardUser { get; set; } = null!;
    public DateTimeOffset? EntryTime { get; set; }
    public DateTimeOffset? ExitTime { get; set; }
    public string? Remarks { get; set; }
}

public sealed class FileAsset : AuditableEntity
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string Checksum { get; set; } = string.Empty;
    public string OwnerModule { get; set; } = string.Empty;
    public Guid? OwnerEntityId { get; set; }
    public Guid UploadedByUserId { get; set; }
    public User UploadedByUser { get; set; } = null!;
}
