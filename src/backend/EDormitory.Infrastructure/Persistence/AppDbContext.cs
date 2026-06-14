using EDormitory.Domain.Accommodation;
using EDormitory.Domain.Billing;
using EDormitory.Domain.Identity;
using EDormitory.Domain.Operations;
using Microsoft.EntityFrameworkCore;

namespace EDormitory.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RelocationRequest> RelocationRequests => Set<RelocationRequest>();
    public DbSet<Violation> Violations => Set<Violation>();
    public DbSet<RepairTicket> RepairTickets => Set<RepairTicket>();
    public DbSet<GuestPass> GuestPasses => Set<GuestPass>();
    public DbSet<PassLog> PassLogs => Set<PassLog>();
    public DbSet<StudentCharge> StudentCharges => Set<StudentCharge>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<Role>(entity =>
        {
            entity.Property(x => x.Name).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.Description).HasMaxLength(300);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(120);
            entity.Property(x => x.Email).HasMaxLength(120);
            entity.Property(x => x.Phone).HasMaxLength(32);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.Property(x => x.Balance).HasPrecision(18, 2);
            entity.HasOne(x => x.Role).WithMany(x => x.Users).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Room).WithMany(x => x.Residents).HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.SetNull);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<Room>(entity =>
        {
            entity.HasIndex(x => x.RoomNumber).IsUnique();
            entity.Property(x => x.RoomNumber).HasMaxLength(20);
            entity.Property(x => x.MonthlyRate).HasPrecision(18, 2);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<RelocationRequest>(entity =>
        {
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.ReviewComment).HasMaxLength(500);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.FromRoom).WithMany().HasForeignKey(x => x.FromRoomId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ToRoom).WithMany().HasForeignKey(x => x.ToRoomId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<Violation>(entity =>
        {
            entity.Property(x => x.Severity).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.RecordedBy).WithMany().HasForeignKey(x => x.RecordedByUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Room).WithMany().HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.SetNull);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<RepairTicket>(entity =>
        {
            entity.Property(x => x.Category).HasMaxLength(120);
            entity.Property(x => x.Title).HasMaxLength(160);
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.MasterNotes).HasMaxLength(1000);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.Priority).HasConversion<string>().HasMaxLength(32);
            entity.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.AssignedToUser).WithMany().HasForeignKey(x => x.AssignedToUserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Room).WithMany().HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<GuestPass>(entity =>
        {
            entity.HasIndex(x => x.AccessCode).IsUnique();
            entity.Property(x => x.GuestFullName).HasMaxLength(120);
            entity.Property(x => x.GuestDocument).HasMaxLength(64);
            entity.Property(x => x.AccessCode).HasMaxLength(64);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            entity.HasOne(x => x.HostUser).WithMany().HasForeignKey(x => x.HostUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<PassLog>(entity =>
        {
            entity.Property(x => x.Remarks).HasMaxLength(500);
            entity.HasOne(x => x.Pass).WithMany(x => x.Logs).HasForeignKey(x => x.PassId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.GuardUser).WithMany().HasForeignKey(x => x.GuardUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<StudentCharge>(entity =>
        {
            entity.Property(x => x.Title).HasMaxLength(160);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.PaidAmount).HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasMaxLength(8);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<Payment>(entity =>
        {
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasMaxLength(8);
            entity.Property(x => x.PaymentMethod).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.TransactionStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(x => x.ExternalReceiptId).HasMaxLength(120);
            entity.Property(x => x.ProviderReference).HasMaxLength(120);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(120);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Charge).WithMany().HasForeignKey(x => x.ChargeId).OnDelete(DeleteBehavior.SetNull);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<UserSession>(entity =>
        {
            entity.Property(x => x.CsrfToken).HasMaxLength(128);
            entity.Property(x => x.UserAgent).HasMaxLength(300);
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

        builder.Entity<RefreshToken>(entity =>
        {
            entity.Property(x => x.TokenHash).HasMaxLength(128);
            entity.Property(x => x.JwtId).HasMaxLength(64);
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasOne(x => x.Session).WithMany(x => x.RefreshTokens).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => x.IsActive);
        });

    }
}
