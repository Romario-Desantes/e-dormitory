namespace EDormitory.Application.Contracts.Files;

public sealed record FileUploadResponse(
    Guid Id,
    string FileName,
    string ContentType,
    long Size,
    string OwnerModule,
    Guid? OwnerEntityId);

public sealed record FileContentResponse(
    string FileName,
    string ContentType,
    Stream Stream);

public interface IFileService
{
    Task<FileUploadResponse> UploadAsync(
        string fileName,
        string contentType,
        long size,
        Stream stream,
        string ownerModule,
        Guid? ownerEntityId,
        CancellationToken cancellationToken = default);

    Task<FileContentResponse> OpenReadAsync(Guid fileId, CancellationToken cancellationToken = default);
}
