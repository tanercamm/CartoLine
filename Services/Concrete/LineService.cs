using CartoLine.Context;
using CartoLine.Dtos.Line;
using CartoLine.Models;
using CartoLine.Services.Abstract;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace CartoLine.Services.Concrete
{
    public class LineService : ILineService
    {
        private readonly AppDbContext _context;

        // SRID=4326 GeometryFactory + Reader
        private static readonly GeometryFactory _gf =
            NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
        private readonly WKTReader _wktReader = new WKTReader(_gf);

        public LineService(AppDbContext context)
        {
            _context = context;
        }

        // WKT -> LineString (2D) + SRID=4326
        private LineString ParseLineWkt(string wkt)
        {
            var geom = _wktReader.Read(wkt);
            if (geom is not LineString ls)
                throw new ArgumentException("WKT LINESTRING olmalı.");

            if (ls.CoordinateSequence.Ordinates.HasFlag(Ordinates.Z))
                throw new ArgumentException("3B koordinat (LINESTRINGZ) desteklenmiyor.");

            // SRID’i 4326’a sabitle
            ls = (LineString)ls.Copy();
            ls.SRID = 4326;
            return ls;
        }

        public List<LineDto> GetAll()
        {
            var entities = _context.Lines.AsNoTracking().ToList();
            var wktWriter = new WKTWriter();

            return entities.Select(p => new LineDto
            {
                Id = p.Id,
                Name = p.Name,
                LineWkt = p.Location != null ? wktWriter.Write(p.Location) : null,
                Type = p.Type,
                RuleContext = p.RuleContext != null
                    ? new RuleContextDto
                    {
                        TypeA = p.RuleContext.TypeA,
                        TypeB = p.RuleContext.TypeB,
                        Rule = p.RuleContext.Rule
                    }
                    : null
            }).ToList();
        }

        public LineDto? GetLineById(long id)
        {
            var e = _context.Lines.AsNoTracking().FirstOrDefault(p => p.Id == id);
            if (e == null) return null;

            var w = new WKTWriter();
            return new LineDto
            {
                Id = e.Id,
                Name = e.Name,
                LineWkt = e.Location != null ? w.Write(e.Location) : null,
                Type = e.Type,
                RuleContext = e.RuleContext != null
                    ? new RuleContextDto
                    {
                        TypeA = e.RuleContext.TypeA,
                        TypeB = e.RuleContext.TypeB,
                        Rule = e.RuleContext.Rule
                    }
                    : null
            };
        }

        public bool AddLine(LineCreateDto lineDto)
        {
            if (lineDto == null) throw new ArgumentNullException(nameof(lineDto));

            var ls = ParseLineWkt(lineDto.LineWkt);

            var entity = new Line
            {
                Name = lineDto.Name,
                Location = ls,
                Type = lineDto.Type,
                RuleContext = lineDto.RuleContext != null
                    ? new RuleContext
                    {
                        TypeA = lineDto.RuleContext.TypeA,
                        TypeB = lineDto.RuleContext.TypeB,
                        Rule = lineDto.RuleContext.Rule
                    }
                    : null
            };

            _context.Lines.Add(entity);
            _context.SaveChanges();
            return true;
        }

        public bool UpdateLine(LineUpdateDto lineDto)
        {
            var e = _context.Lines.FirstOrDefault(p => p.Id == lineDto.Id);
            if (e == null) return false;

            if (!string.IsNullOrWhiteSpace(lineDto.Name))
                e.Name = lineDto.Name;

            if (!string.IsNullOrWhiteSpace(lineDto.LineWkt))
                e.Location = ParseLineWkt(lineDto.LineWkt);

            if (lineDto.Type.HasValue)
                e.Type = lineDto.Type.Value;

            if (lineDto.RuleContext != null)
            {
                e.RuleContext = new RuleContext
                {
                    TypeA = lineDto.RuleContext.TypeA,
                    TypeB = lineDto.RuleContext.TypeB,
                    Rule = lineDto.RuleContext.Rule
                };
            }

            _context.SaveChanges();
            return true;
        }

        public bool DeleteLine(long id)
        {
            var e = _context.Lines.FirstOrDefault(p => p.Id == id);
            if (e == null) return false;

            _context.Lines.Remove(e);
            _context.SaveChanges();
            return true;
        }
    }
}
