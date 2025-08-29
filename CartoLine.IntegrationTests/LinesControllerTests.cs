using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using CartoLine.Dtos.Line;
using CartoLine.Models;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using NUnit.Framework;

namespace CartoLine.IntegrationTests
{
    [TestFixture]
    [Parallelizable(ParallelScope.None)] // güvenli tarafta kalalım
    public class LinesControllerTests
    {
        private TestingAppFactory _factory = null!;
        private HttpClient _client = null!;
        private const string Base = "/api/line";

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        static LinesControllerTests()
        {
            Json.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        }

        [SetUp]
        public void SetUp()
        {
            _factory = new TestingAppFactory();
            _client = _factory.CreateClient();
        }

        [TearDown]
        public void TearDown()
        {
            _client.Dispose();
            _factory.Dispose();
        }

        private sealed class ApiResponse<T>
        {
            public bool Success { get; set; }
            public string? Message { get; set; }
            public T? Data { get; set; }
        }

        // POST gerçekten başarılı mı -> wrap.Success/Data kontrol et.
        // Sonra GET /api/line ile id çıkar.
        private async Task<long> CreateLineAndGetIdAsync(
            string name = "itest-line",
            string wkt = "LINESTRING(0 0, 1 1)")
        {
            var post = await _client.PostAsJsonAsync(Base, new LineCreateDto
            {
                Name = name,
                LineWkt = wkt,
                Type = LineType.Road
            });
            post.EnsureSuccessStatusCode();

            var postWrap = await post.Content.ReadFromJsonAsync<ApiResponse<bool>>(Json);
            Assert.That(postWrap, Is.Not.Null, "POST response parse edilemedi");
            Assert.That(postWrap!.Success, Is.True, $"POST başarısız: {postWrap.Message}");
            Assert.That(postWrap.Data, Is.True, "POST Data=false döndü");

            var all = await _client.GetAsync(Base);
            all.EnsureSuccessStatusCode();

            var wrap = await all.Content.ReadFromJsonAsync<ApiResponse<List<LineDto>>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.True, $"GET /api/line success=false: {wrap.Message}");
            Assert.That(wrap.Data, Is.Not.Null);
            Assert.That(wrap.Data!.Count, Is.GreaterThanOrEqualTo(1), "GET /api/line boş döndü");

            return wrap.Data!.Max(l => l.Id);
        }

        [Test]
        public async Task Create_then_get_by_id_returns_created_item()
        {
            var id = await CreateLineAndGetIdAsync("API-Create", "LINESTRING(0 0, 1 1)");

            var get = await _client.GetAsync($"{Base}/{id}");
            Assert.That(get.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var getWrap = await get.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(getWrap, Is.Not.Null);
            Assert.That(getWrap!.Success, Is.True);
            Assert.That(getWrap.Data, Is.Not.Null);
            Assert.That(getWrap.Data!.Name, Is.EqualTo("API-Create"));
            Assert.That(getWrap.Data.LineWkt, Does.Contain("LINESTRING"));
        }

        [Test]
        public async Task Get_all_returns_list_with_items()
        {
            await CreateLineAndGetIdAsync("Seed-1", "LINESTRING(10 10, 20 20)");

            var resp = await _client.GetAsync(Base);
            Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var wrap = await resp.Content.ReadFromJsonAsync<ApiResponse<List<LineDto>>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.True);
            Assert.That(wrap.Data, Is.Not.Null);
            Assert.That(wrap.Data!.Count, Is.GreaterThanOrEqualTo(1));
        }

        [Test]
        public async Task Get_all_when_empty_returns_no_lines_message()
        {
            // Her test izole DB ile açılıyor → boş olabilir
            var resp = await _client.GetAsync(Base);
            Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var wrap = await resp.Content.ReadFromJsonAsync<ApiResponse<List<LineDto>>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.True);
            Assert.That(wrap.Data, Is.Not.Null);
            Assert.That(wrap.Data!.Count, Is.EqualTo(0));

            Assert.That(
                string.IsNullOrWhiteSpace(wrap.Message) ||
                wrap.Message!.Contains("No lines found", StringComparison.OrdinalIgnoreCase));
        }

        [Test]
        public async Task Update_line_changes_name_and_wkt()
        {
            var id = await CreateLineAndGetIdAsync("Old", "LINESTRING(0 0, 1 1)");

            var put = await _client.PutAsJsonAsync($"{Base}/{id}", new LineUpdateDto
            {
                Id = id,
                Name = "New",
                LineWkt = "LINESTRING(1 1, 2 2)"
            });
            put.EnsureSuccessStatusCode();

            var putWrap = await put.Content.ReadFromJsonAsync<ApiResponse<bool>>(Json);
            Assert.That(putWrap, Is.Not.Null);
            Assert.That(putWrap!.Success, Is.True);
            Assert.That(putWrap.Data, Is.True);

            var get = await _client.GetAsync($"{Base}/{id}");
            var getWrap = await get.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(getWrap, Is.Not.Null);
            Assert.That(getWrap!.Success, Is.True);
            Assert.That(getWrap.Data, Is.Not.Null);
            Assert.That(getWrap.Data!.Name, Is.EqualTo("New"));

            var reader = new WKTReader();
            var geom = reader.Read(getWrap.Data.LineWkt);
            var line = geom as LineString;
            Assert.That(line, Is.Not.Null);
            Assert.That(line!.NumPoints, Is.EqualTo(2));
            var c0 = line.GetCoordinateN(0);
            var c1 = line.GetCoordinateN(1);
            Assert.That(c0.X, Is.EqualTo(1).Within(1e-9));
            Assert.That(c0.Y, Is.EqualTo(1).Within(1e-9));
            Assert.That(c1.X, Is.EqualTo(2).Within(1e-9));
            Assert.That(c1.Y, Is.EqualTo(2).Within(1e-9));
        }

        [Test]
        public async Task Delete_then_get_returns_success_false()
        {
            var id = await CreateLineAndGetIdAsync("DeleteMe", "LINESTRING(5 5, 6 6)");

            var del = await _client.DeleteAsync($"{Base}/{id}");
            del.EnsureSuccessStatusCode();

            var delWrap = await del.Content.ReadFromJsonAsync<ApiResponse<object>>(Json);
            Assert.That(delWrap, Is.Not.Null);
            Assert.That(delWrap!.Success, Is.True);

            var get = await _client.GetAsync($"{Base}/{id}");
            var getWrap = await get.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(getWrap, Is.Not.Null);
            Assert.That(getWrap!.Success, Is.False);
            Assert.That(getWrap.Data, Is.Null);
        }

        [Test]
        public async Task Delete_nonexistent_id_returns_false()
        {
            var del = await _client.DeleteAsync($"{Base}/987654321");
            var wrap = await del.Content.ReadFromJsonAsync<ApiResponse<object>>(Json);

            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.False);
            Assert.That(wrap.Message, Does.Contain("not found").IgnoreCase);
        }

        [Test]
        public async Task Get_by_id_returns_success_false_for_missing_id()
        {
            var resp = await _client.GetAsync($"{Base}/999999");
            Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var wrap = await resp.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.False);
            Assert.That(wrap.Message, Does.Contain("not found").IgnoreCase);
            Assert.That(wrap.Data, Is.Null);
        }

        [Test]
        public async Task Update_returns_error_when_id_mismatch()
        {
            var id = await CreateLineAndGetIdAsync("MismatchSeed", "LINESTRING(0 0, 1 1)");

            var put = await _client.PutAsJsonAsync($"{Base}/{id + 1}", new LineUpdateDto
            {
                Id = id, // bilerek uyuşmaz
                Name = "NewName",
                LineWkt = "LINESTRING(1 1, 2 2)"
            });
            put.EnsureSuccessStatusCode();

            var wrap = await put.Content.ReadFromJsonAsync<ApiResponse<bool?>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.False);
            Assert.That(wrap.Data, Is.Null);
            Assert.That(wrap.Message, Does.Contain("do not match").IgnoreCase);
        }

        [Test]
        public async Task Update_nonexistent_id_returns_false()
        {
            var put = await _client.PutAsJsonAsync($"{Base}/123456",
                new LineUpdateDto { Id = 123456, Name = "X", LineWkt = "LINESTRING(0 0, 1 1)" });

            var wrap = await put.Content.ReadFromJsonAsync<ApiResponse<bool?>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.False);
            Assert.That(wrap.Message, Does.Contain("not found").IgnoreCase);
            Assert.That(!wrap.Data.GetValueOrDefault(), "Data should be false or null when not found");
        }

        [Test]
        public async Task Create_with_invalid_wkt_returns_error()
        {
            var post = await _client.PostAsJsonAsync(Base, new LineCreateDto
            {
                Name = "BadWkt",
                LineWkt = "LINESTRING(0 0, A B)",
                Type = LineType.Road
            });

            Assert.That(post.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            var wrap = await post.Content.ReadFromJsonAsync<ApiResponse<bool?>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.False);
            Assert.That(wrap.Data, Is.Null);
            Assert.That(wrap.Message, Does.Contain("error").IgnoreCase);
        }

        [Test]
        public async Task Health_returns_ok()
        {
            var r = await _client.GetAsync("/health");
            Assert.That(r.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        }
    }
}
