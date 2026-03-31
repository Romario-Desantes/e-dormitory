using EDormitory.Domain.Common;
using EDormitory.Domain.Identity;

namespace EDormitory.Domain.Accommodation;

public sealed class User : AuditableEntity
{
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public Guid? RoomId { get; set; }
    public Room? Room { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public int TokenVersion { get; set; } = 1;
    public bool MustChangePassword { get; set; } = true;

    public void IncreaseTokenVersion(Guid? userId = null)
    {
        TokenVersion++;
        Touch(userId);
    }
}

public sealed class Room : AuditableEntity
{
    public string RoomNumber { get; set; } = string.Empty;
    public int Floor { get; set; }
    public int Capacity { get; set; }
    public decimal MonthlyRate { get; set; }
    public bool IsUnderRepair { get; set; }
    public ICollection<User> Residents { get; set; } = new List<User>();
}

public sealed class RelocationRequest : AuditableEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid FromRoomId { get; set; }
    public Room FromRoom { get; set; } = null!;
    public Guid ToRoomId { get; set; }
    public Room ToRoom { get; set; } = null!;
    public RelocationStatus Status { get; set; } = RelocationStatus.Pending;
    public string Reason { get; set; } = string.Empty;
    public Guid? ReviewedByUserId { get; set; }
    public string? ReviewComment { get; set; }
}

public sealed class Violation : AuditableEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid? RoomId { get; set; }
    public Room? Room { get; set; }
    public Guid RecordedByUserId { get; set; }
    public User RecordedBy { get; set; } = null!;
    public ViolationSeverity Severity { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; }
}
