namespace EDormitory.Domain.Common;

public enum UserRole
{
    Student = 1,
    Commandant = 2,
    Master = 3,
    Guard = 4,
    Accountant = 5,
    Admin = 6,
}

public enum TicketStatus
{
    New = 1,
    InProgress = 2,
    Completed = 3,
}

public enum TicketPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
}

public enum PassStatus
{
    Draft = 1,
    Approved = 2,
    Entered = 3,
    Exited = 4,
    Expired = 5,
    Rejected = 6,
}

public enum PaymentStatus
{
    Pending = 1,
    Confirmed = 2,
    Rejected = 3,
    Failed = 4,
}

public enum PaymentMethod
{
    Manual = 1,
    MockGateway = 2,
}

public enum ViolationSeverity
{
    Low = 1,
    Medium = 2,
    High = 3,
}

public enum RelocationStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
}
