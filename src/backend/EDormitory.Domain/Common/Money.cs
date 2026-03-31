namespace EDormitory.Domain.Common;

public readonly record struct Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency = "UAH") => new(0m, currency);

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount - other.Amount, Currency);
    }

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Money operations require matching currencies.");
        }
    }

    public override string ToString() => $"{Amount:0.00} {Currency}";
}
