using EDormitory.Api.Security;
using EDormitory.Application.Contracts.Rooms;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/rooms")]
[Authorize]
public sealed class RoomsController(IRoomService roomService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<RoomResponse>>> GetRooms(CancellationToken cancellationToken) =>
        Ok(await roomService.GetRoomsAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.ManageRooms)]
    public async Task<ActionResult<RoomDetailResponse>> GetRoomDetail(Guid id, CancellationToken cancellationToken) =>
        Ok(await roomService.GetRoomDetailAsync(id, cancellationToken));

    [HttpGet("occupancy")]
    [Authorize(Policy = Policies.ManageRooms)]
    public async Task<ActionResult<IReadOnlyCollection<RoomOccupancyResponse>>> GetOccupancy(CancellationToken cancellationToken) =>
        Ok(await roomService.GetOccupancyAsync(cancellationToken));

    [HttpGet("relocations")]
    public async Task<ActionResult<IReadOnlyCollection<RelocationRequestResponse>>> GetRelocations(CancellationToken cancellationToken) =>
        Ok(await roomService.GetRelocationRequestsAsync(cancellationToken));

    [HttpPost("relocations")]
    public async Task<ActionResult<RelocationRequestResponse>> CreateRelocation([FromBody] CreateRelocationRequest request, CancellationToken cancellationToken) =>
        Ok(await roomService.CreateRelocationRequestAsync(request, cancellationToken));

    [HttpPost("relocations/{id:guid}/review")]
    [Authorize(Policy = Policies.ManageRooms)]
    public async Task<ActionResult<RelocationRequestResponse>> ReviewRelocation(Guid id, [FromBody] ReviewRelocationRequest request, CancellationToken cancellationToken) =>
        Ok(await roomService.ReviewRelocationRequestAsync(id, request, cancellationToken));

    [HttpGet("violations")]
    public async Task<ActionResult<IReadOnlyCollection<ViolationResponse>>> GetViolations(CancellationToken cancellationToken) =>
        Ok(await roomService.GetViolationsAsync(cancellationToken));

    [HttpPost("violations")]
    [Authorize(Policy = Policies.ManageRooms)]
    public async Task<ActionResult<ViolationResponse>> CreateViolation([FromBody] CreateViolationRequest request, CancellationToken cancellationToken) =>
        Ok(await roomService.CreateViolationAsync(request, cancellationToken));
}
