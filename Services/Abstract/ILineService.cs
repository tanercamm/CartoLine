using CartoLine.Dtos.Line;

namespace CartoLine.Services.Abstract
{
    public interface ILineService
    {
        /// <summary>
        /// All lines are listed.
        /// </summary>
        /// <returns></returns>
        List<LineDto> GetAll();

        /// <summary>
        /// All lines is listed by id.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        LineDto? GetLineById(long id);

        /// <summary>
        /// A new line is added.
        /// </summary>
        /// <param name="p"></param>
        /// <returns></returns>
        bool AddLine(LineCreateDto lineDto);

        /// <summary>
        /// The line is updated by id.
        /// </summary>
        /// <param name="id"></param>
        /// <param name="updatedLine"></param>
        /// <returns></returns>
        bool UpdateLine(LineUpdateDto lineDto);

        /// <summary>
        /// The line is deleted by id.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        bool DeleteLine(long id);
    }
}
