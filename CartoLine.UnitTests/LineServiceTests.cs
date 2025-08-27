using System;
using System.Linq;
using CartoLine.Context;
using CartoLine.Dtos.Line;
using CartoLine.Services.Abstract;
using CartoLine.Services.Concrete;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO;
using NUnit.Framework;

namespace CartoLine.UnitTests
{
    [TestFixture]
    public class LineServiceTests
    {
        private AppDbContext _db = null!;
        private ILineService _sut = null!;

        // WKT karşılaştırmayı format farklarından etkilenmeyecek şekilde yap
        private static void AssertWktTopologicallyEqual(string expectedWkt, string actualWkt)
        {
            var reader = new WKTReader();
            var expected = reader.Read(expectedWkt);
            var actual = reader.Read(actualWkt);

            Assert.That(actual.EqualsTopologically(expected), Is.True,
                $"Expected geometry: {expectedWkt}\nActual geometry:   {actualWkt}");
        }

        [SetUp]
        public void SetUp()
        {
            // Her test için temiz ve benzersiz InMemory veritabanı
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            _db = new AppDbContext(options);
            _sut = new LineService(_db);
        }

        [TearDown]
        public void TearDown() => _db.Dispose();

        [Test]
        public void GetAll_initially_empty()
        {
            var list = _sut.GetAll();
            Assert.That(list, Is.Not.Null);
            Assert.That(list.Count, Is.EqualTo(0));
        }

        [Test]
        public void AddLine_persists_and_lists_back()
        {
            var wkt = "LINESTRING(30 10, 10 30, 40 40)";

            var created = _sut.AddLine(new LineCreateDto
            {
                Name = "Line-A",
                LineWkt = wkt
            });

            Assert.That(created, Is.True);

            var list = _sut.GetAll();
            Assert.That(list.Count, Is.EqualTo(1));
            Assert.That(list[0].Name, Is.EqualTo("Line-A"));
            AssertWktTopologicallyEqual(wkt, list[0].LineWkt);
        }

        [Test]
        public void GetLineById_returns_item_after_create()
        {
            _sut.AddLine(new LineCreateDto
            {
                Name = "L1",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });

            var id = _db.Lines.Select(x => x.Id).Single();

            var dto = _sut.GetLineById(id);
            Assert.That(dto, Is.Not.Null);
            Assert.That(dto!.Name, Is.EqualTo("L1"));
        }

        [Test]
        public void GetLineById_returns_null_when_not_exists()
        {
            var dto = _sut.GetLineById(123456);
            Assert.That(dto, Is.Null);
        }

        [Test]
        public void UpdateLine_changes_name_and_geometry()
        {
            _sut.AddLine(new LineCreateDto
            {
                Name = "Old",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });

            var id = _db.Lines.Select(x => x.Id).Single();

            var newWkt = "LINESTRING(1 1, 2 2)";
            var ok = _sut.UpdateLine(new LineUpdateDto
            {
                Id = id,
                Name = "New",
                LineWkt = newWkt
            });

            Assert.That(ok, Is.True);

            var entity = _db.Lines.Find(id)!;
            Assert.That(entity.Name, Is.EqualTo("New"));

            var dto = _sut.GetLineById(id)!;
            AssertWktTopologicallyEqual(newWkt, dto.LineWkt);
        }

        [Test]
        public void UpdateLine_returns_false_for_missing_id()
        {
            var ok = _sut.UpdateLine(new LineUpdateDto
            {
                Id = 999999,
                Name = "X",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });

            Assert.That(ok, Is.False);
        }

        [Test]
        public void DeleteLine_removes_row_and_returns_true()
        {
            _sut.AddLine(new LineCreateDto
            {
                Name = "DeleteMe",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });

            var id = _db.Lines.Select(x => x.Id).Single();

            var ok = _sut.DeleteLine(id);
            Assert.That(ok, Is.True);

            Assert.That(_db.Lines.Count(), Is.EqualTo(0));
        }

        [Test]
        public void DeleteLine_returns_false_for_missing_id()
        {
            var ok = _sut.DeleteLine(12345);
            Assert.That(ok, Is.False);
        }
    }
}
