namespace CartoLine.Models
{
    public class Response
    {
        public string Message { get; set; }

        public object Data { get; set; }

        public bool Success { get; set; } = false;
    }
}
