# CartoLine

Türkiye odaklı bir çizgi yönetim uygulaması.
**Backend:** .NET (API) • **Frontend:** React + TypeScript (OpenLayers) • **Test:** NUnit/Vitest • **CI:** GitHub Actions

---

## Özellikler

* **Harita (OpenLayers)**: OSM (light/night), Uydu, Topo katmanları.
* **Çizim akışı**: Tip A/B ve Kural seçimi → harita üzerinde LineString çizimi → doğrulama → kaydetme.
* **Kural doğrulama**: `src/lib/rules.ts`

  * Örn: `mustStartOn`, `mustEndOn`, `mustIntersect`, …
  * Tüm tip alias’ları (örn. `doğalgaz` → `naturalgas`) kanonikleştirilir.
* **WKT desteği**: `LINESTRING(lon lat, lon lat, …)` formatı.
* **Test ve Coverage**: Backend + Frontend için birim/integrasyon testleri ve HTML coverage raporu.
* **CI**: Backend ve Frontend testleri ayrı job’larda, coverage artefact olarak yüklenir.

---

## Dizin Yapısı (özet)

```
CartoLine/
├─ clientapp/                  # React + TS (OpenLayers)
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ TurkeyMap.tsx
│  │  │  └─ RuleModal.tsx
│  │  ├─ lib/
│  │  │  └─ rules.ts           # tip kanonikleştirme + kural doğrulama + WKT yardımcıları
│  │  ├─ test/
│  │  │  └─ setup.ts
│  │  ├─ App.tsx
│  │  └─ ...
│  ├─ vitest.config.ts
│  └─ package.json
├─ tests/                      # .NET test projeleri (ör.)
├─ .github/workflows/
│  ├─ dotnet.test.yml          # Backend CI
│  └─ frontend-tests.yml       # Frontend CI
├─ coverlet.runsettings        # .NET coverage için
└─ README.md
```

---

## Gereksinimler

* **.NET SDK** 9.x
* **Node.js** 20.x ve npm
* Git (opsiyonel: Visual Studio / VS Code)

---

## Hızlı Başlangıç

### Backend (API)

> API projesi klasörüne geçip çalıştırın (çözümünüzün yapısına göre yol farklı olabilir).

```powershell
# kökte
dotnet restore
dotnet build -c Release

# API projesine geçip çalıştırın (örnek yol):
# cd src/CartoLine.Api
dotnet run
```

> Frontend, **`axios`** için `baseURL: "/api"` kullanır. `clientapp/package.json` içindeki `proxy` değeri backend URL’nize yönlendirilmelidir (örn. `"proxy": "http://localhost:5000"`).

### Frontend (React)

```powershell
cd clientapp
npm ci
npm start
```

Tarayıcıda `http://localhost:3000` (CRA varsayılanı) açılır.

---

## Test & Coverage

### Backend (.NET)

**Test + Coverage üret:**

```powershell
dotnet clean
dotnet test -c Release --settings coverlet.runsettings
```

**HTML coverage raporu üret (ReportGenerator kurulu değilse kurar):**

```powershell
dotnet tool update -g dotnet-reportgenerator-globaltool
reportgenerator `
  -reports:"./**/TestResults/**/coverage.cobertura.xml" `
  -targetdir:"./CoverageReport" `
  -reporttypes:"Html;TextSummary"
```

**Raporu tarayıcıda aç (Windows PowerShell):**

```powershell
start .\CoverageReport\index.htm
```

**Konsolda özet görmek için:**

```powershell
Get-Content .\CoverageReport\Summary.txt
```

---

### Frontend (Vitest)

**Test + Coverage:**

```powershell
cd clientapp
npm run test:cov
```

**HTML coverage raporunu tarayıcıda aç (Windows PowerShell):**

```powershell
start .\coverage\index.html
```

---

## CI (GitHub Actions)

* **Backend**: `.github/workflows/dotnet.test.yml`

  * Tetikleyiciler: `push` (main/master/develop) ve tüm `pull_request`’ler
  * Adımlar: `dotnet restore/build/test` + reportgenerator → `CoverageReport` artefact’ı
* **Frontend**: `.github/workflows/frontend-tests.yml`

  * Tetikleyiciler: `push` ve `pull_request` (genel)
  * Adımlar: Node 20 kurulumu, `npm ci`, `npm run test:cov` → `clientapp/coverage` artefact’ı
  * Vitest config’de **CI ortamında** coverage eşikleri daha yüksektir (örn. %80).

---

## API (özet)

### `GET /api/line`

Mevcut çizgileri döndürür.

**Örnek yanıt (`200`)**

```json
{
  "data": [
    { "id": 1, "type": 0, "lineWkt": "LINESTRING(26.1 39.0, 27.2 39.4)" }
  ]
}
```

> Frontend tarafında **tip** değeri `rules.ts` içindeki `canonType` ile `"road" | "railway" | ...` biçimine normalize edilir.

### `POST /api/line`

Yeni çizgi kaydeder.

**Gönderim (örnek)**

```json
{
  "name": "Line 2025-01-01 10:30",
  "type": "road",
  "lineWkt": "LINESTRING(26.1 39.0, 27.2 39.4)",
  "ruleContext": { "typeA": "road", "typeB": "railway", "rule": "mustIntersect" }
}
```

**Yanıt (örnek)**

```json
{ "data": { "id": 42, "lineWkt": "LINESTRING(26.1 39.0, 27.2 39.4)", "type": "road" } }
```

---
