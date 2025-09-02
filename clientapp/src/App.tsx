import React, { useEffect, useMemo, useState } from "react";
import TurkeyMap, { LINE_COLORS } from "./components/TurkeyMap";
import Modal from "./components/RuleModal";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";

// ----- Tipler ve Kurallar -----
export const LINE_TYPES = [
    { value: "road", label: "Karayolu" },
    { value: "railway", label: "Demiryolu" },
    { value: "seaway", label: "Denizyolu" },
    { value: "fiber", label: "Fiber Hattı" },
    { value: "energy", label: "Enerji Hattı" },
    { value: "naturalgas", label: "Doğalgaz Hattı" },
    { value: "water", label: "Su Hattı" },
];

export const RULES = [
    { value: "mustStartOn", label: "Başlangıcına çizilmelidir" },
    { value: "mustNotStartOn", label: "Başlangıcına çizilmemelidir" },
    { value: "mustEndOn", label: "Bitişine çizilmelidir" },
    { value: "mustNotEndOn", label: "Bitişine çizilmemelidir" },
    { value: "mustStartOrEndOn", label: "Başlangıç veya bitişine çizilmelidir" },
    { value: "mustNotStartOrEndOn", label: "Başlangıç veya bitişine çizilmemelidir" },
    { value: "mustBodyOn", label: "Gövdesine çizilmelidir" },
    { value: "mustNotBodyOn", label: "Gövdesine çizilmemelidir" },
    { value: "mustIntersect", label: "Kesişmelidir" },
    { value: "mustNotIntersect", label: "Kesişmemelidir" },
];

const NUM_TO_TYPE = ["road", "railway", "seaway", "fiber", "energy", "naturalgas", "water"] as const;
const TYPE_ALIASES: Record<string, (typeof NUM_TO_TYPE)[number]> = {
    dogalgaz: "naturalgas",
    naturalgaz: "naturalgas",
    naturalgas: "naturalgas",
    su: "water",
    water: "water",
    karayolu: "road",
    demiryolu: "railway",
    denizyolu: "seaway",
    fiberoptik: "fiber",
    enerji: "energy",
    elektrik: "energy",
};

function canonType(t: number | string): (typeof NUM_TO_TYPE)[number] | string {
    if (typeof t === "number") return NUM_TO_TYPE[t] ?? String(t);
    const s = t.trim().toLowerCase().replace(/[\s\-_]/g, "");
    if (/^\d+$/.test(s)) {
        const n = Number(s);
        return NUM_TO_TYPE[n] ?? s;
    }
    return TYPE_ALIASES[s] ?? (NUM_TO_TYPE.includes(s as any) ? (s as any) : s);
}

// ----- Basit WKT parser (LINESTRING lon lat) -----
function wktToCoords(wkt: string): [number, number][] {
    const m = wkt.trim().match(/^LINESTRING\s*\((.+)\)$/i);
    if (!m) return [];
    return m[1].split(",").map((pair) => {
        const [lonStr, latStr] = pair.trim().split(/\s+/);
        return [parseFloat(lonStr), parseFloat(latStr)] as [number, number];
    });
}

// ----- Geometri yardımcıları (WGS84) -----
const METERS_TO_DEG = (meters: number) => meters / 111320;

function distPointToSegment(p: [number, number], a: [number, number], b: [number, number]) {
    const [px, py] = p, [ax, ay] = a, [bx, by] = b;
    const vx = bx - ax, vy = by - ay;
    const wx = px - ax, wy = py - ay;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - ax, py - ay);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - bx, py - by);
    const t = c1 / c2;
    const projx = ax + t * vx, projy = ay + t * vy;
    return Math.hypot(px - projx, py - projy);
}

function pointOnPolylineWithin(p: [number, number], line: [number, number][], tolDeg: number) {
    for (let i = 0; i < line.length - 1; i++) {
        if (distPointToSegment(p, line[i], line[i + 1]) <= tolDeg) return true;
    }
    return false;
}

function segmentsIntersect(a1: [number, number], a2: [number, number], b1: [number, number], b2: [number, number]) {
    const cross = (x1: number, y1: number, x2: number, y2: number) => x1 * y2 - y1 * x2;
    const sub = (p: [number, number], q: [number, number]) => [p[0] - q[0], p[1] - q[1]] as [number, number];
    const d1 = sub(a2, a1);
    const d2 = sub(b2, b1);
    const d3 = sub(b1, a1);
    const denom = cross(d1[0], d1[1], d2[0], d2[1]);
    if (Math.abs(denom) < 1e-12) return false;
    const t = cross(d3[0], d3[1], d2[0], d2[1]) / denom;
    const u = cross(d3[0], d3[1], d1[0], d1[1]) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function polylinesIntersect(a: [number, number][], b: [number, number][]) {
    for (let i = 0; i < a.length - 1; i++) {
        for (let j = 0; j < b.length - 1; j++) {
            if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) return true;
        }
    }
    return false;
}

// ----- Kural kontrolü -----
type RuleValue = (typeof RULES)[number]["value"];

function validateRule(
    newLineA: [number, number][],
    typeA: string,
    typeB: string,
    rule: RuleValue,
    allLines: { type: string; wkt: string }[]
): { ok: boolean; reason?: string } {
    const bCanon = canonType(typeB) as string;
    const bLines = allLines.filter((l) => l.type === bCanon).map((l) => wktToCoords(l.wkt));
    if (bLines.length === 0) {
        return { ok: false, reason: `Seçili kuralı doğrulamak için '${bCanon}' tipinde mevcut çizgi yok.` };
    }

    const tolDeg = METERS_TO_DEG(10);
    const start = newLineA[0];
    const end = newLineA[newLineA.length - 1];

    const anyStartOnB = bLines.some((b) => pointOnPolylineWithin(start, b, tolDeg));
    const anyEndOnB = bLines.some((b) => pointOnPolylineWithin(end, b, tolDeg));
    const anyBodyOnB = newLineA.slice(1, -1).some((p) => bLines.some((b) => pointOnPolylineWithin(p, b, tolDeg)));
    const anyIntersect = bLines.some((b) => polylinesIntersect(newLineA, b));

    switch (rule) {
        case "mustStartOn": return anyStartOnB ? { ok: true } : { ok: false, reason: "Başlangıç noktası Tip B üzerinde olmalı." };
        case "mustNotStartOn": return !anyStartOnB ? { ok: true } : { ok: false, reason: "Başlangıç noktası Tip B üzerinde olmamalı." };
        case "mustEndOn": return anyEndOnB ? { ok: true } : { ok: false, reason: "Bitiş noktası Tip B üzerinde olmalı." };
        case "mustNotEndOn": return !anyEndOnB ? { ok: true } : { ok: false, reason: "Bitiş noktası Tip B üzerinde olmamalı." };
        case "mustStartOrEndOn": return (anyStartOnB || anyEndOnB) ? { ok: true } : { ok: false, reason: "Başlangıç veya bitiş Tip B üzerinde olmalı." };
        case "mustNotStartOrEndOn": return (!anyStartOnB && !anyEndOnB) ? { ok: true } : { ok: false, reason: "Başlangıç/bitiş Tip B üzerinde olmamalı." };
        case "mustBodyOn": return anyBodyOnB ? { ok: true } : { ok: false, reason: "Gövde (ara noktalar) Tip B üzerinde olmalı." };
        case "mustNotBodyOn": return !anyBodyOnB ? { ok: true } : { ok: false, reason: "Gövde Tip B üzerinde olmamalı." };
        case "mustIntersect": return anyIntersect ? { ok: true } : { ok: false, reason: "Tip B ile kesişmeli." };
        case "mustNotIntersect": return !anyIntersect ? { ok: true } : { ok: false, reason: "Tip B ile kesişmemeli." };
        default: return { ok: true };
    }
}

// ---- API'den gelen listeyi tek yerde map'leyen yardımcı ----
function mapApiList(data: any): { id: string; type: string; wkt: string }[] {
    const list = (data?.data ?? []) as Array<{ id: number; lineWkt: string; type: number | string }>;
    return list
        .filter((x) => !!x.lineWkt)
        .map((x) => ({
            id: String(x.id),
            type: String(canonType(x.type)),
            wkt: x.lineWkt,
        }));
}

export default function App() {
    const [preOpen, setPreOpen] = useState(false);
    const [postOpen, setPostOpen] = useState(false);

    const [typeA, setTypeA] = useState(LINE_TYPES[0].value);
    const [typeB, setTypeB] = useState(LINE_TYPES[1].value);
    const [rule, setRule] = useState(RULES[0].value);

    const [drawing, setDrawing] = useState(false);
    const [stopSignal, setStopSignal] = useState(0);

    const [pendingWkt, setPendingWkt] = useState<string | null>(null);
    const [name, setName] = useState<string>("");

    const [allLines, setAllLines] = useState<{ id: string; type: string; wkt: string }[]>([]);

    const api = useMemo(() => axios.create({ baseURL: "/api" }), []);

    // -------- Açılışta mevcut çizgileri çek --------
    useEffect(() => {
        (async () => {
            try {
                const r = await api.get("/line");
                setAllLines(mapApiList(r.data));
            } catch {
                toast.error("Çizgiler yüklenemedi.");
            }
        })();
    }, [api]);

    const openPre = () => { setName(""); setPreOpen(true); };
    const handlePreConfirm = () => {
        setPreOpen(false);
        setDrawing(true);
        toast("Çizim modu aktif. Haritaya tıklayarak başlayabilirsin.", { icon: "✏️" });
    };

    const handleDrawEnd = (wkt: string) => {
        const coords = wktToCoords(wkt);
        const result = validateRule(coords, typeA, typeB, rule as any, allLines);

        if (!result.ok) {
            toast.error(`Kural ihlali: ${result.reason}`);
            setDrawing(false);
            setStopSignal((n) => n + 1);
            return;
        }

        setPendingWkt(wkt);
        setDrawing(false);
        setPostOpen(true);
        toast.success("Çizim tamamlandı. Lütfen kaydetmeden önce özet ekranını kontrol et.");
    };

    const discard = () => {
        setPostOpen(false);
        setPendingWkt(null);
        setStopSignal((n) => n + 1);
        setDrawing(false);
        toast("Çizim iptal edildi.", { icon: "🗑️" });
    };

    const save = async () => {
        if (!pendingWkt) return;
        try {
            // 1) Kaydet
            const payload = {
                name: name || `Line ${new Date().toLocaleString()}`,
                lineWkt: pendingWkt,
                type: canonType(typeA),
                ruleContext: { typeA, typeB, rule },
            };
            const r = await api.post("/line", payload);

            // 2) Önce POST yanıtında "created item" var mı dene
            const created = r?.data?.data as
                | { id?: number | string; lineWkt?: string; type?: number | string }
                | undefined;

            if (created?.id && created?.lineWkt) {
                // Doğrudan ekle (kanonik type ile)
                setAllLines((prev) => [
                    ...prev,
                    {
                        id: String(created.id),
                        type: String(canonType(created.type ?? typeA)),
                        wkt: String(created.lineWkt),
                    },
                ]);
            } else {
                // 3) Değilse güvenli fallback: listeyi yeniden çek
                const r2 = await api.get("/line");
                setAllLines(mapApiList(r2.data));
            }

            // 4) UI temizliği
            setPostOpen(false);
            setPendingWkt(null);
            toast.success("Çizgi kaydedildi.");
        } catch (e: any) {
            toast.error("Kaydedilemedi: " + (e?.message ?? "Hata"));
        }
    };

    const labelOf = (list: { value: string; label: string }[], v: string) =>
        list.find((x) => x.value === v)?.label ?? v;

    return (
        <div style={{ position: "relative", width: "100vw", height: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}>
            <TurkeyMap
                onDrawEnd={handleDrawEnd}
                drawing={drawing}
                stopSignal={stopSignal}
                onNewClick={() => { setDrawing(false); setStopSignal((n) => n + 1); openPre(); }}
                onCancelClick={() => { setStopSignal((n) => n + 1); setDrawing(false); toast("Çizim iptal edildi.", { icon: "🛑" }); }}
                currentType={typeA}
                lines={allLines}
            />

            {/* ÖN MODAL */}
            <Modal
                open={preOpen}
                title="Çizim Ayarları"
                onClose={() => setPreOpen(false)}
                footer={
                    <>
                        <button onClick={() => setPreOpen(false)} style={{ padding: "8px 12px" }}>İptal</button>
                        <button onClick={handlePreConfirm} style={{ padding: "8px 12px", background: "#0ea5e9", color: "#fff", borderRadius: 8 }}>
                            Çizime Başla
                        </button>
                    </>
                }
            >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12 }}>
                    <div>
                        <label style={{ fontSize: 12 }}>Tip A</label>
                        <select
                            value={typeA}
                            onChange={(e) => setTypeA(e.target.value)}
                            style={{ width: "100%", padding: 8, borderRadius: 8, borderColor: LINE_COLORS[typeA] ?? "#ddd" }}
                        >
                            {LINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12 }}>Tip B</label>
                        <select
                            value={typeB}
                            onChange={(e) => setTypeB(e.target.value)}
                            style={{ width: "100%", padding: 8, borderRadius: 8, borderColor: LINE_COLORS[typeB] ?? "#ddd" }}
                        >
                            {LINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12 }}>Kural</label>
                        <select value={rule} onChange={(e) => setRule(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8 }}>
                            {RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                    Onaylayınca çizim başlar. ESC ile iptal edebilirsin.
                </p>
                <p style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    Not: Doğrulama toleransı ~10m. Tip B çizgisi yoksa ilgili kural doğrulanamaz.
                </p>
            </Modal>

            {/* SON MODAL */}
            <Modal
                open={postOpen}
                title="Çizim Özeti"
                onClose={discard}
                footer={
                    <>
                        <button onClick={discard} style={{ padding: "8px 12px" }}>Sil</button>
                        <button onClick={save} style={{ padding: "8px 12px", background: "#22c55e", color: "#fff", borderRadius: 8 }}>
                            Kaydet
                        </button>
                    </>
                }
            >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><div style={{ fontSize: 12, color: "#666" }}>Tip A</div><div style={{ fontWeight: 600 }}>{labelOf(LINE_TYPES, typeA)}</div></div>
                    <div><div style={{ fontSize: 12, color: "#666" }}>Tip B</div><div style={{ fontWeight: 600 }}>{labelOf(LINE_TYPES, typeB)}</div></div>
                    <div><div style={{ fontSize: 12, color: "#666" }}>Kural</div><div style={{ fontWeight: 600 }}>{labelOf(RULES, rule)}</div></div>
                    <div>
                        <div style={{ fontSize: 12, color: "#666" }}>İsim</div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Opsiyonel ad"
                            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                        />
                    </div>
                </div>
                <textarea
                    readOnly
                    value={pendingWkt ?? ""}
                    style={{ width: "100%", height: 120, marginTop: 12, padding: 8, borderRadius: 8, border: "1px solid #eee", fontFamily: "monospace" }}
                />
            </Modal>

            {/* Hot Toaster */}
            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    style: { fontSize: 14, borderRadius: 8, padding: "8px 12px" },
                    success: { icon: "✅", style: { background: "#ecfdf5", color: "#065f46" } },
                    error: { icon: "❌", style: { background: "#fef2f2", color: "#991b1b" } },
                }}
            />
        </div>
    );
}
