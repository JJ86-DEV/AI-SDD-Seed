using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Contexts;

/// <summary>
/// Contexto de EF Core de la aplicación. Cada feature añade sus <c>DbSet</c> y su
/// configuración Fluent API (<c>IEntityTypeConfiguration</c> en <c>Contexts/Configurations</c>).
/// </summary>
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
