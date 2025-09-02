import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLines, createLine } from "./lines";

describe("lines service", () => {
    const g: any = globalThis;

    beforeEach(() => {
        g.fetch = vi.fn();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("getLines success", async () => {
        (g.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: [{ id: 1, name: "A", lineWkt: "LINESTRING(0 0,1 1)", type: "road" }],
            }),
        });

        const data = await getLines();
        expect(data.length).toBe(1);
        expect(data[0].name).toBe("A");
    });

    it("createLine success", async () => {
        (g.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: true }),
        });

        const ok = await createLine({ name: "X", lineWkt: "LINESTRING(0 0,1 1)" });
        expect(ok).toBe(true);

        // body doğru gönderilmiş mi
        const [url, init] = (g.fetch as any).mock.calls[0];
        expect(String(url)).toMatch(/\/api\/line$/);
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body).name).toBe("X");
    });

    it("getLines error bubbles", async () => {
        (g.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: false, message: "not found" }),
        });
        await expect(getLines()).rejects.toThrow(/not found/i);
    });
});
