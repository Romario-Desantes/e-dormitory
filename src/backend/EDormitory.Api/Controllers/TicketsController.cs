using EDormitory.Application.Contracts.Tickets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/tickets")]
[Authorize]
public sealed class TicketsController(ITicketService ticketService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<TicketResponse>>> GetTickets(CancellationToken cancellationToken) =>
        Ok(await ticketService.GetTicketsAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TicketDetailResponse>> GetTicket(Guid id, CancellationToken cancellationToken) =>
        Ok(await ticketService.GetTicketDetailAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<TicketResponse>> CreateTicket([FromBody] CreateTicketRequest request, CancellationToken cancellationToken) =>
        Ok(await ticketService.CreateTicketAsync(request, cancellationToken));

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<TicketResponse>> UpdateStatus(Guid id, [FromBody] UpdateTicketStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await ticketService.UpdateStatusAsync(id, request, cancellationToken));
}
