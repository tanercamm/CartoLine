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

        // Controllers
        builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
        );
    });

        // Swagger (UI)
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        // React uygulamasýna eriþim izni
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowReactApp",
                policyBuilder =>
                {
                    policyBuilder
                        .WithOrigins("http://localhost:3000")
                        .AllowAnyHeader()
                        .AllowAnyMethod();
                });
        });

        builder.Services.AddDbContext<AppDbContext>(options =>
                    options.UseNpgsql(builder.Configuration.GetConnectionString("CartoLineDb"),
                    npgsqlOptions => npgsqlOptions.UseNetTopologySuite())
            );

        // Dependency Injection
        builder.Services.AddScoped<ILineService, LineService>();

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(); // /swagger
        }

        app.UseHttpsRedirection();

        // CORS aktif
        app.UseCors("AllowReactApp");

        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }
}