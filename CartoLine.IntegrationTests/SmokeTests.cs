using System.Net;
using NUnit.Framework;

namespace CartoLine.IntegrationTests;

[TestFixture]
public class SmokeTests
{
    private TestingAppFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new TestingAppFactory();
        _client = _factory.CreateClient(); // /health 200 dönecek, redirect yok
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Test]
    public async Task Health_returns_ok()
    {
        var resp = await _client.GetAsync("/health");
        Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }
}
