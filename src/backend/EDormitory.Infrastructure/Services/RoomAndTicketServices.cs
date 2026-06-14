using EDormitory.Application.Abstractions;
using EDormitory.Application.Common;
using EDormitory.Application.Contracts.Rooms;
using EDormitory.Application.Contracts.Tickets;
using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Common;
using EDormitory.Domain.Operations;
using EDormitory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EDormitory.Infrastructure.Services;

public sealed class RoomService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IAuditService auditService) : IRoomService
{
    public async Task<IReadOnlyCollection<RoomResponse>> GetRoomsAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin, UserRole.Student);

        return await dbContext.Rooms
            .OrderBy(room => room.Floor)
            .ThenBy(room => room.RoomNumber)
            .Select(room => new RoomResponse(
                room.Id,
                room.RoomNumber,
                room.Floor,
                room.Capacity,
                room.Residents.Count(resident => resident.IsActive),
                room.MonthlyRate,
                room.IsUnderRepair))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<RoomOccupancyResponse>> GetOccupancyAsync(CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin);
        var rooms = await GetRoomsAsync(cancellationToken);
        return rooms.GroupBy(x => x.Floor).Select(group => new RoomOccupancyResponse(group.Key, group.ToList())).ToList();
    }

    public async Task<RoomDetailResponse> GetRoomDetailAsync(Guid roomId, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin);

        var room = await dbContext.Rooms
            .Include(x => x.Residents.Where(resident => resident.IsActive))
            .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken)
            ?? throw new NotFoundException("РљС–РјРЅР°С‚Сѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        var residentIds = room.Residents
            .Where(resident => resident.IsActive && resident.Role.Name == UserRole.Student)
            .Select(resident => resident.Id)
            .ToArray();

        var debtAmounts = (await dbContext.StudentCharges
            .Where(charge => residentIds.Contains(charge.UserId))
            .Select(charge => new
            {
                charge.UserId,
                Outstanding = charge.Amount - charge.PaidAmount,
            })
            .ToListAsync(cancellationToken))
            .GroupBy(charge => charge.UserId)
            .ToDictionary(
                group => group.Key,
                group => Math.Max(0m, group.Sum(charge => charge.Outstanding)));

        return room.ToDetail(debtAmounts);
    }

    public async Task<RelocationRequestResponse> CreateRelocationRequestAsync(CreateRelocationRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student);
        var user = await dbContext.Users.Include(x => x.Room).FirstAsync(x => x.Id == currentUser.UserId!.Value, cancellationToken);
        if (!user.RoomId.HasValue)
        {
            throw new ConflictException("РЈ РєРѕСЂРёСЃС‚СѓРІР°С‡Р° РЅРµРјР°С” Р·Р°РєСЂС–РїР»РµРЅРѕС— РєС–РјРЅР°С‚Рё.");
        }

        if (user.RoomId == request.ToRoomId)
        {
            throw new ConflictException("Поточну кімнату не можна обрати цільовою для переселення.");
        }

        var toRoom = await dbContext.Rooms
            .Include(x => x.Residents.Where(resident => resident.IsActive))
            .FirstOrDefaultAsync(x => x.Id == request.ToRoomId, cancellationToken)
            ?? throw new NotFoundException("Р¦С–Р»СЊРѕРІСѓ РєС–РјРЅР°С‚Сѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        EnsureRoomHasVacancy(toRoom);

        var relocation = new RelocationRequest
        {
            UserId = user.Id,
            FromRoomId = user.RoomId.Value,
            ToRoomId = toRoom.Id,
            Reason = request.Reason.Trim(),
            CreatedBy = user.Id,
        };

        dbContext.RelocationRequests.Add(relocation);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(RelocationRequest), relocation.Id, "relocation.requested", currentUser.UserId, new { relocation.FromRoomId, relocation.ToRoomId }, cancellationToken);
        return await GetRelocationByIdAsync(relocation.Id, cancellationToken);
    }

    public async Task<IReadOnlyCollection<RelocationRequestResponse>> GetRelocationRequestsAsync(CancellationToken cancellationToken = default)
    {
        var query = dbContext.RelocationRequests
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .Include(x => x.FromRoom)
            .Include(x => x.ToRoom)
            .AsQueryable();

        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.UserId == currentUser.UserId);
        }
        else
        {
            EnsureRole(UserRole.Commandant, UserRole.Admin);
        }

        var items = await query.ToListAsync(cancellationToken);
        items = items.OrderByDescending(x => x.CreatedAt).ToList();
        return items.Select(x => x.ToResponse()).ToList();
    }

    public async Task<RelocationRequestResponse> ReviewRelocationRequestAsync(Guid requestId, ReviewRelocationRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin);
        var relocation = await dbContext.RelocationRequests
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .FirstOrDefaultAsync(x => x.Id == requestId, cancellationToken)
            ?? throw new NotFoundException("Р—Р°РїРёС‚ РЅР° РїРµСЂРµСЃРµР»РµРЅРЅСЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        relocation.Status = request.Decision == RelocationDecision.Approve ? RelocationStatus.Approved : RelocationStatus.Rejected;
        relocation.ReviewComment = request.ReviewComment?.Trim();
        relocation.ReviewedByUserId = currentUser.UserId;
        relocation.Touch(currentUser.UserId);

        if (request.Decision == RelocationDecision.Approve)
        {
            var toRoom = await dbContext.Rooms
                .Include(x => x.Residents.Where(resident => resident.IsActive))
                .FirstOrDefaultAsync(x => x.Id == relocation.ToRoomId, cancellationToken)
                ?? throw new NotFoundException("Р¦С–Р»СЊРѕРІСѓ РєС–РјРЅР°С‚Сѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

            EnsureRoomHasVacancy(toRoom);

            var user = await dbContext.Users.FirstAsync(x => x.Id == relocation.UserId, cancellationToken);
            user.RoomId = relocation.ToRoomId;
            user.Touch(currentUser.UserId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(RelocationRequest), relocation.Id, "relocation.reviewed", currentUser.UserId, new { relocation.Status }, cancellationToken);
        return await GetRelocationByIdAsync(relocation.Id, cancellationToken);
    }

    public async Task<ViolationResponse> CreateViolationAsync(CreateViolationRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin);
        var user = await dbContext.Users
            .Include(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == request.UserId, cancellationToken)
            ?? throw new NotFoundException("РЎС‚СѓРґРµРЅС‚Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        if (user.Role.Name != UserRole.Student)
        {
            throw new ConflictException("Порушення можна фіксувати лише для студентів.");
        }

        var violation = new Violation
        {
            UserId = request.UserId,
            RoomId = request.RoomId,
            RecordedByUserId = currentUser.UserId!.Value,
            Severity = Enum.Parse<ViolationSeverity>(request.Severity, true),
            Description = request.Description.Trim(),
            OccurredAt = request.OccurredAt,
            CreatedBy = currentUser.UserId,
        };

        dbContext.Violations.Add(violation);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(Violation), violation.Id, "violation.created", currentUser.UserId, new { violation.UserId, violation.Severity }, cancellationToken);
        return await GetViolationByIdAsync(violation.Id, cancellationToken);
    }

    public async Task<IReadOnlyCollection<ViolationResponse>> GetViolationsAsync(Guid? userId = null, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Commandant, UserRole.Admin, UserRole.Student);

        var query = dbContext.Violations
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .Include(x => x.Room)
            .Include(x => x.RecordedBy)
            .AsQueryable();

        if (currentUser.Role == UserRole.Student)
        {
            query = query.Where(x => x.UserId == currentUser.UserId);
        }
        else if (userId.HasValue)
        {
            query = query.Where(x => x.UserId == userId.Value);
        }

        var items = await query.ToListAsync(cancellationToken);
        items = items.OrderByDescending(x => x.OccurredAt).ToList();
        return items.Select(x => x.ToResponse()).ToList();
    }

    private async Task<RelocationRequestResponse> GetRelocationByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.RelocationRequests
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .Include(x => x.FromRoom)
            .Include(x => x.ToRoom)
            .FirstAsync(x => x.Id == id, cancellationToken);

        return item.ToResponse();
    }

    private async Task<ViolationResponse> GetViolationByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.Violations
            .IgnoreQueryFilters()
            .Where(x => x.IsActive)
            .Include(x => x.User)
            .Include(x => x.Room)
            .Include(x => x.RecordedBy)
            .FirstAsync(x => x.Id == id, cancellationToken);

        return item.ToResponse();
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РїСЂР°РІ РґР»СЏ С†С–С”С— РґС–С—.");
        }
    }

    private static void EnsureRoomHasVacancy(Room room)
    {
        if (room.IsUnderRepair)
        {
            throw new ConflictException("Кімната перебуває в ремонті та недоступна для заселення.");
        }

        var occupied = room.Residents.Count(resident => resident.IsActive);
        if (occupied >= room.Capacity)
        {
            throw new ConflictException("У вибраній кімнаті вже немає вільних місць.");
        }
    }
}

public sealed class TicketService(
    AppDbContext dbContext,
    ICurrentUserContext currentUser,
    IAuditService auditService) : ITicketService
{
    public async Task<IReadOnlyCollection<TicketResponse>> GetTicketsAsync(CancellationToken cancellationToken = default)
    {
        var query = BuildTicketQuery();
        var tickets = await query.ToListAsync(cancellationToken);
        tickets = tickets.OrderByDescending(x => x.CreatedAt).ToList();
        return tickets.Select(x => x.ToResponse(currentUser.Role!.Value)).ToList();
    }

    public async Task<TicketDetailResponse> GetTicketDetailAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var query = BuildTicketQuery();
        var ticket = await query.FirstOrDefaultAsync(x => x.Id == ticketId, cancellationToken)
            ?? throw new NotFoundException("Р—Р°СЏРІРєСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        return ticket.ToDetail(currentUser.Role!.Value);
    }

    public async Task<TicketResponse> CreateTicketAsync(CreateTicketRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Student, UserRole.Admin);
        var user = await dbContext.Users.FirstAsync(x => x.Id == currentUser.UserId!.Value, cancellationToken);
        if (!user.RoomId.HasValue)
        {
            throw new ConflictException("РџРѕС‚СЂС–Р±РЅРѕ Р±СѓС‚Рё Р·Р°РєСЂС–РїР»РµРЅРёРј Р·Р° РєС–РјРЅР°С‚РѕСЋ, С‰РѕР± СЃС‚РІРѕСЂРёС‚Рё Р·Р°СЏРІРєСѓ.");
        }

        var ticket = new RepairTicket
        {
            Category = request.Category.Trim(),
            CreatedByUserId = user.Id,
            RoomId = user.RoomId.Value,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Priority = request.Priority,
            CreatedBy = currentUser.UserId,
        };

        dbContext.RepairTickets.Add(ticket);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditService.LogAsync(nameof(RepairTicket), ticket.Id, "ticket.created", currentUser.UserId, new { ticket.Title }, cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, currentUser.Role!.Value, cancellationToken);
    }

    public async Task<TicketResponse> UpdateStatusAsync(Guid ticketId, UpdateTicketStatusRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRole(UserRole.Master, UserRole.Admin);
        var ticket = await dbContext.RepairTickets.FirstOrDefaultAsync(x => x.Id == ticketId, cancellationToken)
            ?? throw new NotFoundException("Р—Р°СЏРІРєСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.");

        if (request.Status == TicketStatus.InProgress)
        {
            ticket.Start(currentUser.UserId!.Value, currentUser.UserId);
        }
        else if (request.Status == TicketStatus.Completed)
        {
            ticket.AssignedToUserId ??= currentUser.UserId;
            ticket.Complete(request.MasterNotes, currentUser.UserId);
        }
        else
        {
            ticket.Status = request.Status;
            ticket.MasterNotes = request.MasterNotes;
            ticket.Touch(currentUser.UserId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditService.LogAsync(nameof(RepairTicket), ticket.Id, "ticket.status.updated", currentUser.UserId, new { ticket.Status }, cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, currentUser.Role!.Value, cancellationToken);
    }

    private IQueryable<RepairTicket> BuildTicketQuery()
    {
        var query = dbContext.RepairTickets
            .Include(x => x.Room)
            .Include(x => x.CreatedByUser)
            .Include(x => x.AssignedToUser)
            .AsQueryable();

        return currentUser.Role switch
        {
            UserRole.Student => query.Where(x => x.CreatedByUserId == currentUser.UserId),
            UserRole.Master or UserRole.Commandant or UserRole.Admin => query,
            _ => throw new ForbiddenException("РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РїСЂР°РІ РґР»СЏ РїРµСЂРµРіР»СЏРґСѓ Р·Р°СЏРІРѕРє."),
        };
    }

    private async Task<TicketResponse> GetTicketByIdAsync(Guid id, UserRole role, CancellationToken cancellationToken)
    {
        var ticket = await BuildTicketQuery().FirstAsync(x => x.Id == id, cancellationToken);
        return ticket.ToResponse(role);
    }

    private void EnsureRole(params UserRole[] roles)
    {
        if (!currentUser.Role.HasValue || !roles.Contains(currentUser.Role.Value))
        {
            throw new ForbiddenException("РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РїСЂР°РІ РґР»СЏ С†С–С”С— РґС–С—.");
        }
    }
}

internal static partial class MappingExtensions
{
    public static RelocationRequestResponse ToResponse(this RelocationRequest request) =>
        new(request.Id, request.UserId, request.User.FullName, request.FromRoomId, request.FromRoom.RoomNumber, request.ToRoomId, request.ToRoom.RoomNumber, request.Reason, request.Status.ToString(), request.ReviewComment);

    public static ViolationResponse ToResponse(this Violation violation) =>
        new(violation.Id, violation.UserId, violation.User.FullName, violation.RoomId, violation.Room?.RoomNumber, violation.Severity.ToString(), violation.Description, violation.RecordedBy.FullName, violation.OccurredAt);

    public static RoomDetailResponse ToDetail(this Room room, IReadOnlyDictionary<Guid, decimal> debtAmounts) =>
        new(
            room.Id,
            room.RoomNumber,
            room.Floor,
            room.Capacity,
            room.Residents.Count(resident => resident.IsActive),
            room.MonthlyRate,
            room.IsUnderRepair,
            room.Residents
                .Where(resident => resident.IsActive)
                .OrderBy(resident => resident.FullName)
                .Select(resident => new RoomResidentResponse(
                    resident.Id,
                    resident.FullName,
                    resident.Phone,
                    resident.Role.Name.ToString(),
                    resident.Role.Name == UserRole.Student && debtAmounts.TryGetValue(resident.Id, out var debtAmount)
                        ? debtAmount
                        : resident.Role.Name == UserRole.Student
                            ? resident.Balance
                            : null))
                .ToList());

    public static TicketResponse ToResponse(this RepairTicket ticket, UserRole role) =>
        new(
            ticket.Id,
            ticket.Title,
            ticket.Description,
            ticket.Category,
            ticket.Room.RoomNumber,
            ticket.Status.ToString(),
            ticket.Priority.ToString(),
            ticket.CreatedByUser.FullName,
            role == UserRole.Master ? ticket.CreatedByUser.Phone : null,
            ticket.AssignedToUser?.FullName,
            ticket.MasterNotes,
            ticket.CreatedAt,
            ticket.ResolvedAt);

    public static TicketDetailResponse ToDetail(this RepairTicket ticket, UserRole role) =>
        new(
            ticket.Id,
            ticket.Title,
            ticket.Description,
            ticket.Category,
            ticket.Room.RoomNumber,
            ticket.Status.ToString(),
            ticket.Priority.ToString(),
            ticket.CreatedByUser.FullName,
            role == UserRole.Master ? ticket.CreatedByUser.Phone : null,
            ticket.AssignedToUser?.FullName,
            ticket.MasterNotes,
            ticket.CreatedAt,
            ticket.ResolvedAt);
}
