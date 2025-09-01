// TurkeyMap.tsx
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import Draw from "ol/interaction/Draw";
import Overlay from "ol/Overlay";
import Feature from "ol/Feature";
import type { FeatureLike } from "ol/Feature";
import LineString from "ol/geom/LineString";
import { Style, Stroke } from "ol/style";
import { fromLonLat, get as getProjection, transformExtent, toLonLat } from "ol/proj";
import { buffer as bufferExtent, containsCoordinate } from "ol/extent";
import type { Extent } from "ol/extent";
import "ol/ol.css";

// OL event detach fix
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";

import { keyframes } from "@emotion/react";

// UI
import { Paper, IconButton, Tooltip, Divider, Chip, Grow, Zoom } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import PublicIcon from "@mui/icons-material/Public";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import TerrainIcon from "@mui/icons-material/Terrain";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export const LINE_COLORS: Record<string, string> = {
    road: "#374151",
    railway: "#9A3412",
    seaway: "#1E3A8A",
    fiber: "#9333EA",
    energy: "#EA580C",
    naturalgas: "#16A34A",
    water: "#0EA5E9",
};

const normalizeType = (t?: string) => (t ?? "").toLowerCase().replace(/[\s\-_]/g, "");
const TYPE_ALIASES: Record<string, keyof typeof LINE_COLORS> = {
    dogalgaz: "naturalgas",
    naturalgas: "naturalgas",
    naturalgaz: "naturalgas",
    naturalgasline: "naturalgas",
    su: "water",
    water: "water",
    denizyolu: "seaway",
    sea: "seaway",
    seaway: "seaway",
    demiryolu: "railway",
    railway: "railway",
    karayolu: "road",
    road: "road",
    fiberoptik: "fiber",
    fiber: "fiber",
    elektrik: "energy",
    enerji: "energy",
    energy: "energy",
};
function colorFor(raw?: string): string {
    const key = normalizeType(raw);
    const mapped = TYPE_ALIASES[key] || (key in LINE_COLORS ? (key as keyof typeof LINE_COLORS) : undefined);
    if (!mapped) {
        console.warn("[TurkeyMap] Bilinmeyen line type:", raw);
        return "#64748B";
    }
    return LINE_COLORS[mapped];
}

type SavedLine = { id: string; type: string; wkt: string };

type Props = {
    onDrawEnd: (wkt: string) => void;
    drawing: boolean;
    stopSignal: number;
    onNewClick?: () => void;
    onCancelClick?: () => void;
    currentType?: string;
    lines?: SavedLine[];
};

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(14,165,233,0.45); transform: scale(1); }
  70%  { box-shadow: 0 0 0 10px rgba(14,165,233,0); transform: scale(1.04); }
  100% { box-shadow: 0 0 0 0 rgba(14,165,233,0); transform: scale(1); }
`;

const TR_BBOX: [number, number, number, number] = [26, 36, 45, 42];

const defaultLineStyle = new Style({
    stroke: new Stroke({ color: "#0ea5e9", width: 3 }),
});

function toWktLineString(coords3857: number[][]): string {
    const s = coords3857
        .map((c) => {
            const [lon, lat] = toLonLat(c);
            return `${lon.toFixed(6)} ${lat.toFixed(6)}`;
        })
        .join(", ");
    return `LINESTRING(${s})`;
}

function wktToCoords(wkt: string): [number, number][] {
    const m = wkt.trim().match(/^LINESTRING\s*\((.+)\)$/i);
    if (!m) return [];
    return m[1].split(",").map((pair) => {
        const [lonStr, latStr] = pair.trim().split(/\s+/);
        return [parseFloat(lonStr), parseFloat(latStr)] as [number, number];
    });
}

export default function TurkeyMap({
    onDrawEnd,
    drawing,
    stopSignal,
    onNewClick,
    onCancelClick,
    currentType,
    lines,
}: Props) {
    const hostRef = useRef<HTMLDivElement | null>(null);

    const mapRef = useRef<Map | null>(null);
    const viewRef = useRef<View | null>(null);

    // base layers
    const osmLightRef = useRef<TileLayer<OSM> | null>(null);
    const osmNightRef = useRef<TileLayer<XYZ> | null>(null);
    const satRef = useRef<TileLayer<XYZ> | null>(null);
    const topoRef = useRef<TileLayer<XYZ> | null>(null);

    // vector
    const vSrcRef = useRef(new VectorSource());
    const vLayerRef = useRef(new VectorLayer({ source: vSrcRef.current, style: defaultLineStyle }));
    const drawRef = useRef<Draw | null>(null);
    const roRef = useRef<ResizeObserver | null>(null);

    const extentRef = useRef<Extent | null>(null);
    const overlayRef = useRef<Overlay | null>(null);
    const overlayElRef = useRef<HTMLDivElement | null>(null);

    // move event key ref
    const moveKeyRef = useRef<EventsKey | null>(null);

    const [base, setBase] = useState<"osm" | "sat" | "topo">("osm");
    const [osmTheme, setOsmTheme] = useState<"light" | "night">("light");

    const [showData, setShowData] = useState(true);
    const showDataRef = useRef(showData);

    const styleCacheRef = useRef<Record<string, Style>>({});
    const getStrokeStyle = (color: string) => {
        if (!styleCacheRef.current[color]) {
            styleCacheRef.current[color] = new Style({ stroke: new Stroke({ color, width: 3 }) });
        }
        return styleCacheRef.current[color];
    };

    // INIT
    useEffect(() => {
        if (!hostRef.current) return;

        if (mapRef.current && viewRef.current) {
            mapRef.current.setTarget(hostRef.current);
            mapRef.current.updateSize();
        } else {
            const baseExtent = transformExtent(TR_BBOX, "EPSG:4326", "EPSG:3857");
            const extent3857 = bufferExtent(baseExtent, 200000);
            extentRef.current = extent3857;

            const view = new View({
                projection: getProjection("EPSG:3857")!,
                center: fromLonLat([35.5, 39]),
                zoom: 6.7,
                minZoom: 3,
                maxZoom: 18,
                extent: extent3857,
                constrainOnlyCenter: false,
                multiWorld: false,
            });
            viewRef.current = view;

            const osmLight = new TileLayer({
                source: new OSM({ wrapX: false }),
                visible: true,
                zIndex: 0,
            });

            const osmNight = new TileLayer({
                source: new XYZ({
                    url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                    wrapX: false,
                    attributions: "© OpenStreetMap contributors, © CARTO",
                }),
                visible: false,
                zIndex: 0,
            });

            const esriSat = new TileLayer({
                source: new XYZ({
                    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    wrapX: false,
                    attributions: "© Esri & contributors",
                }),
                visible: false,
                zIndex: 0,
            });

            const openTopo = new TileLayer({
                source: new XYZ({
                    url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
                    wrapX: false,
                    attributions: "© OpenTopoMap (CC-BY-SA)",
                }),
                visible: false,
                zIndex: 0,
            });

            osmLightRef.current = osmLight;
            osmNightRef.current = osmNight;
            satRef.current = esriSat;
            topoRef.current = openTopo;

            // vector layer üstte
            vLayerRef.current.setZIndex(10);

            const map = new Map({
                target: hostRef.current!,
                layers: [osmLight, osmNight, esriSat, openTopo, vLayerRef.current],
                view,
                // Not: OpenLayers varsayılan kontrolleri (Zoom vb.) zaten aktif.
            });
            mapRef.current = map;

            // Cursor overlay
            const el = document.createElement("div");
            el.style.width = "12px";
            el.style.height = "12px";
            el.style.borderRadius = "9999px";
            el.style.pointerEvents = "none";
            el.style.transform = "translate(-50%, -50%)";
            el.style.display = "none";
            overlayElRef.current = el;

            const overlay = new Overlay({ element: el, offset: [0, 0], positioning: "center-center", stopEvent: false });
            overlayRef.current = overlay;
            map.addOverlay(overlay);

            roRef.current = new ResizeObserver(() => map.updateSize());
            roRef.current.observe(hostRef.current);
        }
    }, []);

    // base + theme visibility
    useEffect(() => {
        const osmLight = osmLightRef.current;
        const osmNight = osmNightRef.current;
        const sat = satRef.current;
        const topo = topoRef.current;
        if (!osmLight || !osmNight || !sat || !topo) return;

        const isOSM = base === "osm";
        osmLight.setVisible(isOSM && osmTheme === "light");
        osmNight.setVisible(isOSM && osmTheme === "night");
        sat.setVisible(base === "sat");
        topo.setVisible(base === "topo");
    }, [base, osmTheme]);

    // Layer style
    useEffect(() => {
        const styleFn = (feature: FeatureLike): Style | undefined => {
            const persisted = !!feature.get("persisted");
            if (persisted && !showDataRef.current) return undefined;

            const typeRaw = feature.get("lineType") as string | undefined;
            const color = persisted ? colorFor(typeRaw) : "#0ea5e9";
            return getStrokeStyle(color);
        };

        vLayerRef.current!.setStyle(styleFn);
    }, []);

    useEffect(() => {
        showDataRef.current = showData;
        vLayerRef.current?.changed();
    }, [showData]);

    // Drawing
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !drawing) {
            if (overlayElRef.current) overlayElRef.current.style.display = "none";
            if (map) map.getTargetElement()?.style && (map.getTargetElement()!.style.cursor = "");
            if (moveKeyRef.current) {
                unByKey(moveKeyRef.current);
                moveKeyRef.current = null;
            }
            return;
        }

        map.getTargetElement()!.style.cursor = "crosshair";
        if (drawRef.current) map.removeInteraction(drawRef.current);

        const draw = new Draw({ source: vSrcRef.current, type: "LineString", stopClick: true });
        draw.on("drawend", (evt) => {
            // @ts-expect-error
            const coords3857: number[][] = evt.feature.getGeometry().getCoordinates();

            const trExtent = extentRef.current;
            if (trExtent) {
                const outIndex = coords3857.findIndex((c) => !containsCoordinate(trExtent, c));
                if (outIndex !== -1) {
                    vSrcRef.current.removeFeature(evt.feature);
                    map.removeInteraction(draw);
                    drawRef.current = null;
                    if (overlayElRef.current) overlayElRef.current.style.display = "none";
                    alert("❌ Hata: Çizim Türkiye sınırlarının dışına çıktı. Lütfen sınırlar içinde kalın.");
                    onCancelClick?.();
                    return;
                }
            }

            // geçici feature
            evt.feature.set("persisted", false);
            evt.feature.set("temp", true);

            const wkt = toWktLineString(coords3857);
            map.removeInteraction(draw);
            drawRef.current = null;
            if (overlayElRef.current) overlayElRef.current.style.display = "none";
            map.getTargetElement()!.style.cursor = "";
            onDrawEnd(wkt);
        });

        map.addInteraction(draw);
        drawRef.current = draw;

        const handleMove = (evt: any) => {
            if (!overlayRef.current || !overlayElRef.current) return;
            overlayRef.current.setPosition(evt.coordinate);
            overlayElRef.current.style.display = "block";
        };
        moveKeyRef.current = map.on("pointermove", handleMove as any);

        const onKeyDown = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement).isContentEditable);
            if (e.key === "Escape" && !typing) {
                try {
                    draw.abortDrawing();
                } catch { }
                map.removeInteraction(draw);
                drawRef.current = null;
                if (overlayElRef.current) overlayElRef.current.style.display = "none";
                map.getTargetElement()!.style.cursor = "";
                onCancelClick?.();
            }
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            if (moveKeyRef.current) {
                unByKey(moveKeyRef.current);
                moveKeyRef.current = null;
            }
        };
    }, [drawing, onDrawEnd, onCancelClick]);

    // Clear temps on stopSignal
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        try {
            drawRef.current?.abortDrawing();
        } catch { }
        if (drawRef.current) {
            map.removeInteraction(drawRef.current);
            drawRef.current = null;
        }
        if (overlayElRef.current) overlayElRef.current.style.display = "none";
        map.getTargetElement()!.style.cursor = "";
        if (moveKeyRef.current) {
            unByKey(moveKeyRef.current);
            moveKeyRef.current = null;
        }

        const src = vSrcRef.current;
        src
            .getFeatures()
            .filter((f) => !f.get("persisted"))
            .forEach((f) => src.removeFeature(f));
    }, [stopSignal]);

    // Render persisted lines
    useEffect(() => {
        const src = vSrcRef.current;
        if (!src) return;

        src
            .getFeatures()
            .filter((f) => f.get("persisted"))
            .forEach((f) => src.removeFeature(f));
        if (!lines || lines.length === 0) return;

        lines.forEach((l) => {
            const coords4326 = wktToCoords(l.wkt);
            if (coords4326.length < 2) return;

            const coords3857 = coords4326.map(([lon, lat]) => fromLonLat([lon, lat]));
            const geom = new LineString(coords3857);
            const feat = new Feature({ geometry: geom });

            feat.set("persisted", true);
            feat.set("lineType", l.type);
            src.addFeature(feat);
        });

        vLayerRef.current?.changed();
    }, [lines]);

    // cursor marker color
    useEffect(() => {
        const el = overlayElRef.current;
        if (!el) return;
        const color = colorFor(currentType);
        el.style.background = color;
        el.style.boxShadow = `0 0 0 0 ${color}80`;
        el.style.border = "2px solid #fff";
        // @ts-ignore
        el.style.animation = `${(pulse as any).name ?? "pulse"} 1.8s infinite`;
    }, [currentType]);

    // styles
    const pillStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 6,
        boxShadow: "0 18px 48px rgba(0,0,0,0.18)",
        backdropFilter: "blur(6px)",
    };

    const btnStyle = (active: boolean, hovered: boolean): CSSProperties => ({
        width: 40,
        height: 40,
        borderRadius: 10,
        border: active ? "2px solid #0ea5e9" : "1px solid #e5e7eb",
        background: active ? "#e0f2fe" : "#fff",
        boxShadow: hovered ? "0 12px 28px rgba(0,0,0,0.18)" : "0 8px 20px rgba(0,0,0,0.12)",
        transform: hovered ? "translateY(-1px) scale(1.06)" : "translateY(0) scale(1)",
        transition:
            "transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
    });

    const tinyBtnStyle = (active: boolean): CSSProperties => ({
        width: 32,
        height: 32,
        borderRadius: 8,
        border: active ? "2px solid #0ea5e9" : "1px solid #e5e7eb",
        background: "#fff",
        boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 140ms cubic-bezier(.2,.8,.2,1), box-shadow 140ms ease",
    });

    const [hovered, setHovered] = useState<"osm" | "sat" | "topo" | null>(null);
    const [toggleHover, setToggleHover] = useState(false);

    const trackStyle = (checked: boolean): CSSProperties => ({
        width: 46,
        height: 28,
        borderRadius: 9999,
        position: "relative",
        cursor: "pointer",
        background: checked ? "linear-gradient(135deg,#67e8f9,#0ea5e9)" : "#f3f4f6",
        border: `1px solid ${checked ? "#67e8f9" : "#e5e7eb"}`,
        boxShadow: toggleHover ? "0 12px 28px rgba(0,0,0,.18)" : "0 8px 20px rgba(0,0,0,.12)",
        transition: "background .2s ease,border-color .2s ease,box-shadow .2s ease",
    });

    const knobStyle = (checked: boolean): CSSProperties => ({
        position: "absolute",
        top: 2,
        left: 2,
        width: 24,
        height: 24,
        borderRadius: 9999,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 14px rgba(0,0,0,.18)",
        transform: checked ? "translateX(18px)" : "translateX(0)",
        transition: "transform 220ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms ease",
    });

    return (
        <div style={{ position: "fixed", inset: 0 }}>
            <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

            <style>{`
        @keyframes dtgPulse {
          0% { box-shadow: 0 0 0 0 rgba(14,165,233,.35); }
          100% { box-shadow: 0 0 0 12px rgba(14,165,233,0); }
        }
      `}</style>

            {/* Sağ üst panel */}
            <Paper
                elevation={3}
                sx={{
                    position: "absolute",
                    right: 16,
                    top: 16,
                    p: 1,
                    borderRadius: 2,
                    backdropFilter: "blur(8px)",
                    bgcolor: "rgba(255,255,255,0.88)",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                }}
            >
                {/* Veri katmanı toggle */}
                <Tooltip title={showData ? "Veri katmanı: Açık" : "Veri katmanı: Kapalı"} placement="left" arrow>
                    <div
                        role="switch"
                        aria-checked={showData}
                        tabIndex={0}
                        onMouseEnter={() => setToggleHover(true)}
                        onMouseLeave={() => setToggleHover(false)}
                        onClick={() => setShowData((v) => !v)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setShowData((v) => !v);
                            }
                        }}
                        style={{ ...trackStyle(showData), marginBottom: 8 }}
                    >
                        {showData && (
                            <span
                                key={showData ? "on" : "off"}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: 9999,
                                    animation: "dtgPulse 600ms ease-out",
                                }}
                            />
                        )}
                        <span style={knobStyle(showData)}>
                            {showData ? <VisibilityIcon sx={{ fontSize: 16 }} /> : <VisibilityOffIcon sx={{ fontSize: 16 }} />}
                        </span>
                    </div>
                </Tooltip>

                <Chip
                    size="small"
                    label={drawing ? "🟢 Çizim: Aktif" : "⚪ Çizim: Kapalı"}
                    color={drawing ? "primary" : "default"}
                    sx={{
                        mb: 0.5,
                        fontWeight: "bold",
                        px: 1.5,
                        ...(drawing && { animation: `${pulse} 2s infinite`, bgcolor: "#0ea5e9", color: "white" }),
                    }}
                />

                <Tooltip
                    title={
                        <div>
                            <b>Yeni Çizim</b>
                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                                Paneli aç; Tip A / Tip B / Kural seç. Onaydan sonra haritada <b>LineString</b> çizersin.
                            </div>
                        </div>
                    }
                    placement="left"
                    arrow
                >
                    <span>
                        <IconButton aria-label="Yeni çizim" color="primary" onClick={onNewClick} size="medium" disabled={drawing}>
                            <AddIcon />
                        </IconButton>
                    </span>
                </Tooltip>

                <Divider flexItem sx={{ my: 0.5 }} />

                {/* İptal */}
                <Tooltip
                    title={
                        drawing ? (
                            <div>
                                <b>İptal (Esc)</b>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                    Devam eden çizimi iptal eder. Kısayol: <b>ESC</b>.
                                </div>
                            </div>
                        ) : (
                            "Aktif çizim yok"
                        )
                    }
                    placement="left"
                    arrow
                >
                    <span>
                        <IconButton
                            aria-label="İptal"
                            color={drawing ? "warning" : "default"}
                            size="medium"
                            disabled={!drawing}
                            onClick={() => {
                                if (!drawing) return;
                                onCancelClick?.();
                            }}
                        >
                            <CancelIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Paper>

            {/* Sol alt – görünüm anahtarı + OSM alt tema mini-dock */}
            <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 10 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                    <Grow in={base === "osm"} timeout={220} mountOnEnter unmountOnExit style={{ transformOrigin: "left bottom" }}>
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                bottom: "calc(100% + 8px)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                padding: 4,
                                borderRadius: 10,
                                background: "rgba(255,255,255,0.96)",
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 14px 32px rgba(0,0,0,0.18)",
                                backdropFilter: "blur(6px)",
                            }}
                        >
                            <Zoom in={true} style={{ transitionDelay: "60ms" }}>
                                <IconButton
                                    onClick={() => setOsmTheme("light")}
                                    size="small"
                                    style={tinyBtnStyle(osmTheme === "light")}
                                    aria-label="OSM Light"
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                >
                                    <LightModeIcon fontSize="inherit" />
                                </IconButton>
                            </Zoom>

                            <Zoom in={true} style={{ transitionDelay: "120ms" }}>
                                <IconButton
                                    onClick={() => setOsmTheme("night")}
                                    size="small"
                                    style={tinyBtnStyle(osmTheme === "night")}
                                    aria-label="OSM Night"
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                >
                                    <DarkModeIcon fontSize="inherit" />
                                </IconButton>
                            </Zoom>
                        </div>
                    </Grow>

                    <div style={pillStyle}>
                        <Tooltip title="Harita (OSM)" arrow>
                            <IconButton
                                onMouseEnter={() => setHovered("osm")}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => setBase("osm")}
                                size="small"
                                style={btnStyle(base === "osm", hovered === "osm")}
                                aria-label="Harita (OSM)"
                            >
                                <PublicIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Uydu (Esri World Imagery)" arrow>
                            <IconButton
                                onMouseEnter={() => setHovered("sat")}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => setBase("sat")}
                                size="small"
                                style={btnStyle(base === "sat", hovered === "sat")}
                                aria-label="Uydu görünümü"
                            >
                                <SatelliteAltIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Topo (OpenTopoMap)" arrow>
                            <IconButton
                                onMouseEnter={() => setHovered("topo")}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => setBase("topo")}
                                size="small"
                                style={btnStyle(base === "topo", hovered === "topo")}
                                aria-label="Topo görünümü"
                            >
                                <TerrainIcon />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
}
