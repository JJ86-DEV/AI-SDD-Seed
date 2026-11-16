namespace Application.Exceptions;

/// <summary>
/// Recurso no encontrado (HTTP 404).
/// </summary>
/// <param name="message">Mensaje descriptivo.</param>
public class NotFoundException(string message) : Exception(message);
