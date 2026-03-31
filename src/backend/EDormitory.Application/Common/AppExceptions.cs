namespace EDormitory.Application.Common;

public class AppException : Exception
{
    public AppException(string message) : base(message)
    {
    }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message)
    {
    }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message) : base(message)
    {
    }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message) : base(message)
    {
    }
}
