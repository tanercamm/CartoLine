export const NUM_TO_TYPE = ["road", "railway", "seaway", "fiber", "energy", "naturalgas", "water"] as const;

const TYPE_ALIASES: Record<string, (typeof NUM_TO_TYPE)[number]> = {
    dogalgaz: "naturalgas", naturalgaz: "naturalgas", naturalgas: "naturalgas",
    su: "water", water: "water",
    karayolu: "road",
    demiryolu: "railway",
    denizyolu: "seaway",
    fiberoptik: "fiber",
    enerji: "energy", elektrik: "energy",
};

export function canonType(t: number | string): (typeof NUM_TO_TYPE)[number] | string {
    if (typeof t === "number") return NUM_TO_TYPE[t] ?? String(t);
    const s = String(t).trim().toLowerCase().replace(/[\s\-_]/g, "");
    if (/^\d+$/.test(s)) {
        const n = Number(s);
        return NUM_TO_TYPE[n] ?? s;
    }
    return TYPE_ALIASES[s] ?? (NUM_TO_TYPE.includes(s as any) ? (s as any) : s);
}

export type RuleValue =
    | "mustStartOn" | "mustNotStartOn"
    | "mustEndOn" | "mustNotEndOn"
    | "mustStartOrEndOn" | "mustNotStartOrEndOn"
    | "mustBodyOn" | "mustNotBodyOn"
    | "mustIntersect" | "mustNotIntersect";

export function wktToCoords(wkt: string): [number, number][] {
    const m = wkt.trim().match(/^LINESTRING\s*\((.+)\)$/i);
    if (!m) return [];
    return m[1].split(",").map((pair) => {
        const [lonStr, latStr] = pair.trim().split(/\s+/);
        return [parseFloat(lonStr), parseFloat(latStr)] as [number, number];
    });
}

// --- Geometri yardımcıları (WGS84 yaklaşık) ---
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

export function validateRule(
    newLineA: [number, number][],
    typeA: string,
    typeB: string,
    rule: RuleValue,
    allLines: { type: string; wkt: string }[]
): { ok: boolean; reason?: string } {
    const bCanon = String(canonType(typeB));
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
