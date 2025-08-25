using CartoLine.Models;
using System.ComponentModel.DataAnnotations;

namespace CartoLine.Dtos.Line
{
    public sealed class RuleContextDto
    {
        [Required]
        public LineType TypeA { get; set; }

        [Required]
        public LineType TypeB { get; set; }

        [Required]
        public Rule Rule { get; set; }
    }
}
