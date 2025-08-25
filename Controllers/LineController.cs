using CartoLine.Dtos.Line;
using CartoLine.Models;
using CartoLine.Services.Abstract;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CartoLine.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LineController : ControllerBase
    {
        private readonly ILineService _lineService;

        public LineController(ILineService lineService)
        {
            _lineService = lineService;
        }

        [HttpGet]
        public Response GetLines()
        {
            var res = new Response();
            try
            {
                var lines = _lineService.GetAll();
                res.Data = lines;
                res.Success = true;
                res.Message = lines.Any() ? "Lines listed successfully." : "No lines found.";
            }
            catch (Exception ex)
            {
                res.Message = $"List error: {ex.Message}";
            }
            return res;
        }

        [HttpGet("{id:long}")]
        public Response GetByIdLine(long id)
        {
            var res = new Response();
            try
            {
                var line = _lineService.GetLineById(id);
                res.Data = line;
                res.Success = line != null;
                res.Message = line != null ? "Line found." : $"Line with ID {id} not found.";
            }
            catch (Exception ex)
            {
                res.Message = $"GetById error: {ex.Message}";
            }
            return res;
        }

        [HttpPost]
        public Response AddLine([FromBody] LineCreateDto lineDto)
        {
            var res = new Response();
            try
            {
                if (!ModelState.IsValid)
                {
                    res.Message = "Invalid input data.";
                    return res;
                }

                var ok = _lineService.AddLine(lineDto);
                res.Success = ok;
                res.Data = ok;
                res.Message = ok ? "Line added successfully." : "Failed to add line.";
            }
            catch (ArgumentException ex)
            {
                res.Message = $"Geometry/validation error: {ex.Message}";
            }
            catch (DbUpdateException ex)
            {
                res.Message = $"Database error: {ex.InnerException?.Message ?? ex.Message}";
            }
            catch (Exception ex)
            {
                res.Message = $"Unexpected error: {ex.Message}";
            }
            return res;
        }

        [HttpPut("{id:long}")]
        public Response UpdateLine(long id, [FromBody] LineUpdateDto lineDto)
        {
            var res = new Response();
            try
            {
                if (!ModelState.IsValid)
                {
                    res.Message = "Invalid input data.";
                    return res;
                }
                if (id != lineDto.Id)
                {
                    res.Message = "ID in URL and body do not match.";
                    return res;
                }

                var ok = _lineService.UpdateLine(lineDto);
                res.Success = ok;
                res.Data = ok;
                res.Message = ok ? "Line updated successfully." : "Line not found.";
            }
            catch (ArgumentException ex)
            {
                res.Message = $"Geometry/validation error: {ex.Message}";
            }
            catch (DbUpdateException ex)
            {
                res.Message = $"Database error: {ex.InnerException?.Message ?? ex.Message}";
            }
            catch (Exception ex)
            {
                res.Message = $"Unexpected error: {ex.Message}";
            }
            return res;
        }

        [HttpDelete("{id:long}")]
        public Response DeleteLine(long id)
        {
            var res = new Response();
            try
            {
                var ok = _lineService.DeleteLine(id);
                res.Success = ok;
                res.Message = ok ? "Line deleted successfully." : "Line not found.";
            }
            catch (Exception ex)
            {
                res.Message = $"Delete error: {ex.Message}";
            }
            return res;
        }
    }
}
