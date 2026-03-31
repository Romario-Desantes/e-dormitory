using EDormitory.Application.Abstractions;
using EDormitory.Application.Contracts.Auth;
using EDormitory.Application.Contracts.Directories;
using EDormitory.Application.Contracts.Files;
using EDormitory.Application.Contracts.Notifications;
using EDormitory.Application.Contracts.Passes;
using EDormitory.Application.Contracts.Payments;
using EDormitory.Application.Contracts.Rooms;
using EDormitory.Application.Contracts.Tickets;
using EDormitory.Application.Contracts.Users;
using EDormitory.Infrastructure.Auth;
using EDormitory.Infrastructure.Persistence;
using EDormitory.Infrastructure.Services;
using EDormitory.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using System.Text;

namespace EDormitory.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtOptions = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions
        {
            SigningKey = Convert.ToBase64String(Encoding.UTF8.GetBytes("edormitory-dev-signing-key-2026")),
        };
        if (string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
        {
            jwtOptions.SigningKey = "edormitory-dev-signing-key-2026";
        }

        var storageOptions = configuration.GetSection(StorageOptions.SectionName).Get<StorageOptions>() ?? new StorageOptions();

        services.AddSingleton<IOptions<JwtOptions>>(Options.Create(jwtOptions));
        services.AddSingleton<IOptions<StorageOptions>>(Options.Create(storageOptions));

        services.AddDbContext<AppDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString("Postgres");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("Connection string 'Postgres' is required.");
            }

            options.UseNpgsql(connectionString);
        });

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHasher, Argon2PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IPaymentProvider, MockPaymentProvider>();
        services.AddSingleton(storageOptions);
        services.AddSingleton<IFileStorage, DiskFileStorage>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoomService, RoomService>();
        services.AddScoped<ITicketService, TicketService>();
        services.AddScoped<IPassService, PassService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IDirectoryService, DirectoryService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IFileService, FileService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<DataSeeder>();

        return services;
    }
}
