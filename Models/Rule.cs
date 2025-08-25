namespace CartoLine.Models
{
    public enum Rule
    {
        MustStartOn, // Başlangıca çizilmeli
        MustNotStartOn, // Başlangıca çizilmemeli
        MustEndOn, // Bitişe çizilmeli
        MustNotEndOn, // Bitişe çizilmemeli
        MustStartOrEndOn, // Başlangıç veya bitişe çizilmeli
        MustNotStartOrEndOn, // Başlangıç veya bitişe çizilmemeli
        MustBodyOn, // Gövdesine çizilmeli
        MustNotBodyOn, // Gövdesine çizilmemeli
        MustIntersect, // Kesişmeli
        MustNotIntersect // Kesişmemeli
    }
}
