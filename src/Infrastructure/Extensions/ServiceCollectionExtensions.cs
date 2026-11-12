using Infrastructure.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Extensions;

/// <summary>
/// Registro de dependencias de la capa Infrastructure.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registra el <see cref="ApplicationDbContext"/> (SQLite) y los repositorios.
    /// La cadena de conexión se lee de <c>ConnectionStrings:Default</c>.
    /// </summary>
    /// <param name="services">Colección de servicios.</param>
    /// <param name="configuration">Configuración de la aplicación.</param>
    /// <returns>La misma colección, para encadenar.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Falta ConnectionStrings:Default en la configuración.");

        services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(connectionString));

        return services;
    }
}
