import React, { useEffect, useMemo, useState } from "react";
import TurkeyMap, { LINE_COLORS } from "./components/TurkeyMap";
import Modal from "./components/RuleModal";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import { canonType, wktToCoords, validateRule, type RuleValue } from "./lib/rules";

// Tipler ve Kurallar
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
    const [rule, setRule] = useState<RuleValue>("mustStartOn");

    const [drawing, setDrawing] = useState(false);
    const [stopSignal, setStopSignal] = useState(0);

    const [pendingWkt, setPendingWkt] = useState<string | null>(null);
    const [name, setName] = useState<string>("");

    const [allLines, setAllLines] = useState<{ id: string; type: string; wkt: string }[]>([]);

    const api = useMemo(() => axios.create({ baseURL: "/api" }), []);

    // Açılışta mevcut çizgiler gelsin
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

    const openPre = () => {
        setName("");
        setPreOpen(true);
    };
    const handlePreConfirm = () => {
        setPreOpen(false);
        setDrawing(true);
        toast("Çizim modu aktif. Haritaya tıklayarak başlayabilirsin.", { icon: "✏️" });
    };

    const handleDrawEnd = (wkt: string) => {
        const coords = wktToCoords(wkt);
        const result = validateRule(coords, typeA, typeB, rule, allLines);

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
            const payload = {
                name: name || `Line ${new Date().toLocaleString()}`,
                lineWkt: pendingWkt,
                type: canonType(typeA),
                ruleContext: { typeA, typeB, rule },
            };
            const r = await api.post("/line", payload);

            const created = r?.data?.data as
                | { id?: number | string; lineWkt?: string; type?: number | string }
                | undefined;

            if (created?.id && created?.lineWkt) {
                setAllLines((prev) => [
                    ...prev,
                    {
                        id: String(created.id),
                        type: String(canonType(created.type ?? typeA)),
                        wkt: String(created.lineWkt),
                    },
                ]);
            } else {
                const r2 = await api.get("/line");
                setAllLines(mapApiList(r2.data));
            }

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
                onNewClick={() => {
                    setDrawing(false);
                    setStopSignal((n) => n + 1);
                    openPre();
                }}
                onCancelClick={() => {
                    setStopSignal((n) => n + 1);
                    setDrawing(false);
                    toast("Çizim iptal edildi.", { icon: "🛑" });
                }}
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
                        <button onClick={() => setPreOpen(false)} style={{ padding: "8px 12px" }}>
                            İptal
                        </button>
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
                            {LINE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12 }}>Tip B</label>
                        <select
                            value={typeB}
                            onChange={(e) => setTypeB(e.target.value)}
                            style={{ width: "100%", padding: 8, borderRadius: 8, borderColor: LINE_COLORS[typeB] ?? "#ddd" }}
                        >
                            {LINE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 12 }}>Kural</label>
                        <select
                            value={rule}
                            onChange={(e) => setRule(e.target.value as RuleValue)}
                            style={{ width: "100%", padding: 8, borderRadius: 8 }}
                        >
                            {RULES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Onaylayınca çizim başlar. ESC ile iptal edebilirsin.</p>
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
                        <button onClick={discard} style={{ padding: "8px 12px" }}>
                            Sil
                        </button>
                        <button onClick={save} style={{ padding: "8px 12px", background: "#22c55e", color: "#fff", borderRadius: 8 }}>
                            Kaydet
                        </button>
                    </>
                }
            >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#666" }}>Tip A</div>
                        <div style={{ fontWeight: 600 }}>{labelOf(LINE_TYPES, typeA)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: "#666" }}>Tip B</div>
                        <div style={{ fontWeight: 600 }}>{labelOf(LINE_TYPES, typeB)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: "#666" }}>Kural</div>
                        <div style={{ fontWeight: 600 }}>{labelOf(RULES, rule)}</div>
                    </div>
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
