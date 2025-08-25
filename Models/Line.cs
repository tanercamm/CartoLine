using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CartoLine.Models
{
    public class Line
    {
        public long Id { get; set; }

        [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters.")]
        public string Name { get; set; }

        [Column(TypeName = "geometry(LineString,4326)")]
        public LineString Location { get; set; }

        public LineType Type { get; set; }

        [Column(TypeName = "jsonb")]
        public RuleContext? RuleContext { get; set; }
    }
}
