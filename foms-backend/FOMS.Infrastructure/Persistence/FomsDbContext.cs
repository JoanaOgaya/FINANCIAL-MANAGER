using Microsoft.EntityFrameworkCore;
using FOMS.Domain.Entities.SqlServer;

namespace FOMS.Infrastructure.Persistence;

public class FomsDbContext : DbContext
{
    public FomsDbContext(DbContextOptions<FomsDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles { get; set; } = null!;
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Client> Clients { get; set; } = null!;
    public DbSet<ClientFinanceSetting> ClientFinanceSettings { get; set; } = null!;
    public DbSet<ClientRate> ClientRates { get; set; } = null!;
    public DbSet<Invoice> Invoices { get; set; } = null!;
    public DbSet<AccountsReceivable> AccountsReceivable { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<PaymentHistory> PaymentHistory { get; set; } = null!;
    public DbSet<Notification> Notifications { get; set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>().ToTable("Roles", "dbo");
        modelBuilder.Entity<User>().ToTable("Users", "dbo");
        modelBuilder.Entity<Client>().ToTable("Clients", "dbo");
        modelBuilder.Entity<ClientFinanceSetting>().ToTable("ClientFinanceSettings", "dbo");
        modelBuilder.Entity<ClientRate>().ToTable("ClientRates", "dbo");
        modelBuilder.Entity<Invoice>().ToTable("Invoices", "dbo");
        modelBuilder.Entity<AccountsReceivable>().ToTable("AccountsReceivable", "dbo");
        modelBuilder.Entity<Payment>().ToTable("Payments", "dbo");
        modelBuilder.Entity<PaymentHistory>().ToTable("PaymentHistory", "dbo");
        modelBuilder.Entity<Notification>().ToTable("Notifications", "dbo");
        modelBuilder.Entity<AuditLog>().ToTable("AuditLogs", "dbo");
    }
}
