namespace EDormitory.Application.Contracts.Directories;

public sealed record RoleDirectoryResponse(Guid Id, string Name, string Description);

public interface IDirectoryService
{
    Task<IReadOnlyCollection<RoleDirectoryResponse>> GetRolesAsync(CancellationToken cancellationToken = default);
}
