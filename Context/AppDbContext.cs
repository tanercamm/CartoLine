using CartoLine.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CartoLine.Context
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Line> Lines { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                // enum'ları sayı olarak tutacaksan bu satırı çıkar; string istiyorsan bırak
                // Converters = { new JsonStringEnumConverter() }
            };

            var ruleContextConverter = new ValueConverter<RuleContext?, string?>(
                v => v == null ? null : JsonSerializer.Serialize(v, jsonOptions),
                v => string.IsNullOrWhiteSpace(v) ? null : JsonSerializer.Deserialize<RuleContext>(v!, jsonOptions)
            );

            modelBuilder.Entity<Line>(entity =>
            {
                entity.ToTable("line");

                entity.HasKey(e => e.Id);

                entity.Property(e => e.Id)
                      .HasColumnName("id")
                      .ValueGeneratedOnAdd();

                entity.Property(e => e.Name)
                      .HasColumnName("name")
                      .HasMaxLength(100)
                      .IsRequired();

                entity.Property(e => e.Location)
                      .HasColumnName("location")
                      .HasColumnType("geometry(LineString,4326)")
                      .IsRequired();

                entity.HasIndex(e => e.Location).HasMethod("GIST");

                entity.Property(e => e.Type)
                      .HasColumnName("type")
                      .HasConversion<int>();

                entity.Property(e => e.RuleContext)
              .HasColumnName("rulecontext")
              .HasColumnType("jsonb")
              .HasConversion(ruleContextConverter);

                entity.HasIndex(e => e.RuleContext).HasMethod("GIN");
            });
        }
    }
}
