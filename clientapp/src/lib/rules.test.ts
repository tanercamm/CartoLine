import { describe, it, expect } from "vitest";
import { validateRule, wktToCoords } from "./rules";

const B = { type: "road", wkt: "LINESTRING(0 0, 10 0)" }; // Tip B: yatay hat (y=0)

describe("validateRule", () => {
    it("mustStartOn: başlangıç B üzerinde olmalı (pass)", () => {
        const A = [[0, 0], [1, 1]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustStartOn", [B]);
        expect(r.ok).toBe(true);
    });

    it("mustStartOn: değilse fail", () => {
        const A = [[0, 1], [1, 2]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustStartOn", [B]);
        expect(r.ok).toBe(false);
    });

    it("mustEndOn: bitiş B üzerinde olmalı (pass)", () => {
        const A = [[1, 1], [5, 0]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustEndOn", [B]);
        expect(r.ok).toBe(true);
    });

    it("mustBodyOn: iç nokta B üzerinde olmalı (pass)", () => {
        const A = [[4, 1], [5, 0], [6, 1]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustBodyOn", [B]);
        expect(r.ok).toBe(true);
    });

    it("mustIntersect: A, B ile kesişmeli (pass)", () => {
        const A = [[5, -1], [5, 1]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustIntersect", [B]);
        expect(r.ok).toBe(true);
    });

    it("mustNotIntersect: kesişmemeli (pass)", () => {
        const A = [[0, 1], [1, 2]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustNotIntersect", [B]);
        expect(r.ok).toBe(true);
    });

    it("mustNotStartOrEndOn: başlangıç ve bitiş B üzerinde olmamalı (fail örneği)", () => {
        const A = [[0, 0], [1, 1]] as [number, number][];
        const r = validateRule(A, "railway", "road", "mustNotStartOrEndOn", [B]);
        expect(r.ok).toBe(false);
    });

    it("B tipi yoksa açıklayıcı hata dönmeli", () => {
        const A = wktToCoords("LINESTRING(0 0, 1 1)");
        const r = validateRule(A, "railway", "water", "mustIntersect", []); // B yok
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/mevcut çizgi yok/);
    });
});
