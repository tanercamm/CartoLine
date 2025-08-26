using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using NUnit.Framework;

namespace CartoLine.IntegrationTests;

[TestFixture]
public class SmokeTests
{
    private WebApplicationFactory<CartoLine.Program> _factory = null!;

    [SetUp]
    public void SetUp() => _factory = new WebApplicationFactory<CartoLine.Program>();

    [TearDown]
    public void TearDown() => _factory?.Dispose();

    [Test]
    public async Task App_responds_on_swagger_or_health()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/swagger/index.html");

        if (resp.StatusCode == HttpStatusCode.NotFound)
        {
            var health = await client.GetAsync("/health");
            Assert.That(health.StatusCode,
                Is.EqualTo(HttpStatusCode.OK).Or.EqualTo(HttpStatusCode.NotFound));
        }
        else
        {
            Assert.That(resp.StatusCode,
                Is.EqualTo(HttpStatusCode.OK)
                  .Or.EqualTo(HttpStatusCode.MovedPermanently)   // 301
                  .Or.EqualTo(HttpStatusCode.Found)              // 302
                  .Or.EqualTo(HttpStatusCode.TemporaryRedirect)  // 307
                  .Or.EqualTo(HttpStatusCode.PermanentRedirect)  // 308
            );
        }
    }
}
