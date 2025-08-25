using CartoLine.Models;
using System.ComponentModel.DataAnnotations;

namespace CartoLine.Dtos.Line
{
    public sealed class LineCreateDto
    {
        [Required, StringLength(100)]
        public string Name { get; set; } = default!;

        [Required]
        public string LineWkt { get; set; } = default!;

        [Required]
        public LineType Type { get; set; }

        public RuleContextDto? RuleContext { get; set; }
    }
}
