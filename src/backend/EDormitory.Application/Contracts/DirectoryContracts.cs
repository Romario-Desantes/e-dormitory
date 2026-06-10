using FluentValidation;

namespace EDormitory.Application.Contracts.Directories;

public sealed record TicketCategoryResponse(Guid Id, string CategoryName, int SlaHours);

public sealed record RoleDirectoryResponse(Guid Id, string Name, string Description);

public sealed record TariffResponse(Guid Id, string Name, decimal MonthlyRate, int? Floor, bool IsDefault);

public sealed record UpsertTicketCategoryRequest(string CategoryName, int SlaHours);

public sealed record UpsertTariffRequest(string Name, decimal MonthlyRate, int? Floor, bool IsDefault);

public sealed class UpsertTicketCategoryRequestValidator : AbstractValidator<UpsertTicketCategoryRequest>
{
    public UpsertTicketCategoryRequestValidator()
    {
        RuleFor(x => x.CategoryName).NotEmpty().MaximumLength(120);
        RuleFor(x => x.SlaHours).InclusiveBetween(1, 720);
    }
}

public sealed class UpsertTariffRequestValidator : AbstractValidator<UpsertTariffRequest>
{
    public UpsertTariffRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.MonthlyRate).GreaterThan(0);
        RuleFor(x => x.Floor).InclusiveBetween(1, 25).When(x => x.Floor.HasValue);
    }
}

public interface IDirectoryService
{
    Task<IReadOnlyCollection<TicketCategoryResponse>> GetTicketCategoriesAsync(CancellationToken cancellationToken = default);
    Task<TicketCategoryResponse> CreateTicketCategoryAsync(UpsertTicketCategoryRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<RoleDirectoryResponse>> GetRolesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<TariffResponse>> GetTariffsAsync(CancellationToken cancellationToken = default);
    Task<TariffResponse> CreateTariffAsync(UpsertTariffRequest request, CancellationToken cancellationToken = default);
    Task<TariffResponse> UpdateTariffAsync(Guid tariffId, UpsertTariffRequest request, CancellationToken cancellationToken = default);
    Task DeleteTariffAsync(Guid tariffId, CancellationToken cancellationToken = default);
}
