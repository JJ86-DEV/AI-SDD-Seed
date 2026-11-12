using Microsoft.Extensions.DependencyInjection;

namespace Application.Extensions;

/// <summary>
/// Registro de dependencias de la capa Application.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registra los servicios de Application.
    /// </summary>
    /// <param name="services">Colección de servicios.</param>
    /// <returns>La misma colección, para encadenar.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        return services;
    }
}
