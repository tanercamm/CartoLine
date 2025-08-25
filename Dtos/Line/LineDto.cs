using CartoLine.Models;

namespace CartoLine.Dtos.Line
{
    public class LineDto : IDto
    {
        public long Id { get; set; }

        public string Name { get; set; }

        public string LineWkt { get; set; }

        public LineType Type { get; set; }

        // jsonb -> dto
        public RuleContextDto? RuleContext { get; set; }
    }
}
