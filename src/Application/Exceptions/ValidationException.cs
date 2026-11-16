namespace Application.Exceptions;

/// <summary>
/// Error de validación de negocio (HTTP 400).
/// </summary>
/// <param name="message">Mensaje descriptivo.</param>
public class ValidationException(string message) : Exception(message);
