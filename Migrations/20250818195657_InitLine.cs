using CartoLine.Models;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace CartoLine.Migrations
{
    /// <inheritdoc />
    public partial class InitLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<LineString>(
                name: "location",
                table: "line",
                type: "geometry(LineString,4326)",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry (LineString, 4326)");

            migrationBuilder.AddColumn<RuleContext>(
                name: "rulecontext",
                table: "line",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "type",
                table: "line",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "rulecontext",
                table: "line");

            migrationBuilder.DropColumn(
                name: "type",
                table: "line");

            migrationBuilder.AlterColumn<LineString>(
                name: "location",
                table: "line",
                type: "geometry (LineString, 4326)",
                nullable: false,
                oldClrType: typeof(LineString),
                oldType: "geometry(LineString,4326)");
        }
    }
}
