using CartoLine.Context;
using CartoLine.Services.Abstract;
using CartoLine.Services.Concrete;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CartoLine;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Controllers + JSON
        builder.Services.AddControllers()
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.Converters.Add(
                    new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
            });

        // Swagger + Health
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        builder.Services.AddHealthChecks();

        // CORS
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowReactApp", policy =>
                policy.WithOrigins("http://localhost:3000")
                      .AllowAnyHeader()
                      .AllowAnyMethod());
        });

        if (builder.Environment.IsEnvironment("Testing"))
        {
            builder.Services.AddDbContext<AppDbContext>(opt =>
                opt.UseInMemoryDatabase("CartoLine_TestDb"));
        }
        else
        {
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(
                    builder.Configuration.GetConnectionString("CartoLineDb"),
                    npgsql => npgsql.UseNetTopologySuite()));
        }

        // DI
        builder.Services.AddScoped<ILineService, LineService>();

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        if (!app.Environment.IsEnvironment("Testing"))
            app.UseHttpsRedirection();

        app.UseCors("AllowReactApp");
        app.UseAuthorization();

        app.MapHealthChecks("/health");
        app.MapControllers();

        app.Run();
    }
}
