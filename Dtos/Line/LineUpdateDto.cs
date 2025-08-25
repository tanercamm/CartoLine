using CartoLine.Models;
using System.ComponentModel.DataAnnotations;

namespace CartoLine.Dtos.Line
{
    public sealed class LineUpdateDto : IDto
    {
        public long Id { get; set; }

        [StringLength(100)]
        public string? Name { get; set; }

        public string? LineWkt { get; set; }

        public LineType? Type { get; set; }

        public RuleContextDto? RuleContext { get; set; }
    }
}
