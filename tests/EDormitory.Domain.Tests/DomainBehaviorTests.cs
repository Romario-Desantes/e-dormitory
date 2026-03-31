using EDormitory.Domain.Common;
using EDormitory.Domain.Operations;

namespace EDormitory.Domain.Tests;

public sealed class DomainBehaviorTests
{
    [Fact]
    public void Money_Add_And_Subtract_Work_For_Same_Currency()
    {
        var start = new Money(100m, "UAH");
        var increment = new Money(25m, "UAH");

        var increased = start.Add(increment);
        var decreased = increased.Subtract(new Money(10m, "UAH"));

        Assert.Equal(125m, increased.Amount);
        Assert.Equal(115m, decreased.Amount);
    }

    [Fact]
    public void Money_Add_Throws_For_Different_Currencies()
    {
        var first = new Money(100m, "UAH");
        var second = new Money(50m, "USD");

        Assert.Throws<InvalidOperationException>(() => first.Add(second));
    }

    [Fact]
    public void RepairTicket_Can_Move_Through_Lifecycle()
    {
        var ticket = new RepairTicket
        {
            Title = "Broken lamp",
            Description = "Ceiling lamp in room 101",
        };

        var masterId = Guid.NewGuid();
        ticket.Start(masterId, masterId);
        ticket.Complete("Lamp replaced", masterId);

        Assert.Equal(TicketStatus.Completed, ticket.Status);
        Assert.Equal(masterId, ticket.AssignedToUserId);
        Assert.Equal("Lamp replaced", ticket.MasterNotes);
        Assert.NotNull(ticket.ResolvedAt);
    }
}
