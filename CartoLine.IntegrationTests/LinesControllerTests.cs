using System.Net;
using System.Net.Http.Json;
using CartoLine.Context;
using CartoLine.Dtos.Line;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NUnit.Framework;
using System.Text.Json;
using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace CartoLine.IntegrationTests
{
    [TestFixture]
    public class LinesControllerTests
    {
        private TestingAppFactory _factory = null!;
        private HttpClient _client = null!;
        private const string Base = "/api/line";

        // API'nin enum'ları string (camelCase) döndürmesiyle uyumlu JSON seçenekleri
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

        private async Task<long> GetLastLineIdAsync()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.Lines.MaxAsync(x => x.Id);
        }

        private sealed class ApiResponse<T>
        {
            public bool Success { get; set; }
            public string? Message { get; set; }
            public T? Data { get; set; }
        }

        [Test]
        public async Task Create_then_get_by_id_returns_created_item()
        {
            // POST
            var post = await _client.PostAsJsonAsync(Base, new LineCreateDto
            {
                Name = "API-Create",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });

            Assert.That(post.StatusCode, Is.EqualTo(HttpStatusCode.OK));
            var postWrap = await post.Content.ReadFromJsonAsync<ApiResponse<bool>>(Json);
            Assert.That(postWrap, Is.Not.Null);
            Assert.That(postWrap!.Success, Is.True);
            Assert.That(postWrap.Data, Is.True);

            // Id'yi InMemory DB'den al
            var id = await GetLastLineIdAsync();

            // GET /api/line/{id}
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
            // En az bir kayıt yoksa ekle
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                if (!await db.Lines.AnyAsync())
                {
                    var seed = await _client.PostAsJsonAsync(Base, new LineCreateDto
                    {
                        Name = "Seed-1",
                        LineWkt = "LINESTRING(10 10, 20 20)"
                    });
                    Assert.That(seed.StatusCode, Is.EqualTo(HttpStatusCode.OK));
                }
            }

            var resp = await _client.GetAsync(Base);
            Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var wrap = await resp.Content.ReadFromJsonAsync<ApiResponse<List<LineDto>>>(Json);
            Assert.That(wrap, Is.Not.Null);
            Assert.That(wrap!.Success, Is.True);
            Assert.That(wrap.Data, Is.Not.Null);
            Assert.That(wrap.Data!.Count, Is.GreaterThanOrEqualTo(1));
        }

        [Test]
        public async Task Update_line_changes_name_and_wkt()
        {
            // seed
            var post = await _client.PostAsJsonAsync(Base, new LineCreateDto
            {
                Name = "Old",
                LineWkt = "LINESTRING(0 0, 1 1)"
            });
            Assert.That(post.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var id = await GetLastLineIdAsync();

            var put = await _client.PutAsJsonAsync($"{Base}/{id}", new LineUpdateDto
            {
                Id = id,
                Name = "New",
                LineWkt = "LINESTRING(1 1, 2 2)"
            });
            Assert.That(put.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            // (bool döndüğü için enum problemi yok ama tutarlılık için Json verelim)
            var putWrap = await put.Content.ReadFromJsonAsync<ApiResponse<bool>>(Json);
            Assert.That(putWrap, Is.Not.Null);
            Assert.That(putWrap!.Success, Is.True);
            Assert.That(putWrap.Data, Is.True);

            // Doğrulama
            var get = await _client.GetAsync($"{Base}/{id}");
            var getWrap = await get.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(getWrap, Is.Not.Null);
            Assert.That(getWrap!.Success, Is.True);
            Assert.That(getWrap.Data, Is.Not.Null);
            Assert.That(getWrap.Data!.Name, Is.EqualTo("New"));

            // --- WKT'yi parse edip geometri üstünden kontrol et ---
            var reader = new WKTReader();
            var geom = reader.Read(getWrap.Data.LineWkt);
            var line = geom as LineString;
            Assert.That(line, Is.Not.Null, "Geometry should be a LineString");

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
            var post = await _client.PostAsJsonAsync(Base, new LineCreateDto
            {
                Name = "DeleteMe",
                LineWkt = "LINESTRING(5 5, 6 6)"
            });
            Assert.That(post.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var id = await GetLastLineIdAsync();

            var del = await _client.DeleteAsync($"{Base}/{id}");
            Assert.That(del.StatusCode, Is.EqualTo(HttpStatusCode.OK));

            var delWrap = await del.Content.ReadFromJsonAsync<ApiResponse<object>>(Json);
            Assert.That(delWrap, Is.Not.Null);
            Assert.That(delWrap!.Success, Is.True);

            var get = await _client.GetAsync($"{Base}/{id}");
            var getWrap = await get.Content.ReadFromJsonAsync<ApiResponse<LineDto>>(Json);
            Assert.That(getWrap, Is.Not.Null);
            Assert.That(getWrap!.Success, Is.False); // controller: bulunamayınca Success=false
            Assert.That(getWrap.Data, Is.Null);
        }
    }
}
