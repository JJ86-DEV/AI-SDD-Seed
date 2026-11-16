using System.Text.Json;
using Api.Middlewares;
using Application.Exceptions;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace UnitTests.Api;

[TestClass]
public class ApplicationExceptionHandlerTests
{
    private static async Task<(bool Handled, int Status, ProblemDetails? Body)> RunAsync(Exception ex)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var handled = await new ApplicationExceptionHandler().TryHandleAsync(context, ex, CancellationToken.None);

        context.Response.Body.Position = 0;
        ProblemDetails? body = null;
        if (handled)
        {
            body = await JsonSerializer.DeserializeAsync<ProblemDetails>(
                context.Response.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }

        return (handled, context.Response.StatusCode, body);
    }

    [TestMethod]
    public async Task TryHandleAsync_NotFound_Returns404()
    {
        var (handled, status, body) = await RunAsync(new NotFoundException("nf"));

        handled.Should().BeTrue();
        status.Should().Be(404);
        body!.Status.Should().Be(404);
        body.Detail.Should().Be("nf");
    }

    [TestMethod]
    public async Task TryHandleAsync_Conflict_Returns409()
    {
        var (handled, status, body) = await RunAsync(new ConflictException("dup"));

        handled.Should().BeTrue();
        status.Should().Be(409);
        body!.Detail.Should().Be("dup");
    }

    [TestMethod]
    public async Task TryHandleAsync_Validation_Returns400()
    {
        var (handled, status, body) = await RunAsync(new ValidationException("bad"));

        handled.Should().BeTrue();
        status.Should().Be(400);
        body!.Status.Should().Be(400);
    }

    [TestMethod]
    public async Task TryHandleAsync_OtherException_ReturnsFalse()
    {
        var (handled, _, _) = await RunAsync(new InvalidOperationException("boom"));

        handled.Should().BeFalse();
    }
}
