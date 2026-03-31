using EDormitory.Application.Contracts.Files;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDormitory.Api.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public sealed class FilesController(IFileService fileService) : ControllerBase
{
    public sealed class UploadFileRequest
    {
        public IFormFile File { get; set; } = null!;
        public string OwnerModule { get; set; } = string.Empty;
        public Guid? OwnerEntityId { get; set; }
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<FileUploadResponse>> Upload([FromForm] UploadFileRequest request, CancellationToken cancellationToken)
    {
        var file = request.File;
        await using var stream = file.OpenReadStream();
        var result = await fileService.UploadAsync(
            file.FileName,
            file.ContentType,
            file.Length,
            stream,
            request.OwnerModule,
            request.OwnerEntityId,
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}/content")]
    public async Task<IActionResult> GetContent(Guid id, CancellationToken cancellationToken)
    {
        var file = await fileService.OpenReadAsync(id, cancellationToken);
        return File(file.Stream, file.ContentType, file.FileName, enableRangeProcessing: true);
    }
}
