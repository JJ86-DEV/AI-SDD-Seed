namespace Application.Exceptions;

/// <summary>
/// Conflicto con el estado actual (HTTP 409).
/// </summary>
/// <param name="message">Mensaje descriptivo.</param>
public class ConflictException(string message) : Exception(message);
