using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CartoLine.IntegrationTests;

public class TestingAppFactory : WebApplicationFactory<CartoLine.Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Sadece ortamı Testing yap; başka hiçbir kayıt/override yok!
        builder.UseEnvironment("Testing");
    }
}
