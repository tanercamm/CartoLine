import "@testing-library/jest-dom";
import { vi } from "vitest";
import "./mockOpenLayers";

/**
 * FETCH
 * - Node 18+ already has global fetch.
 * - Don't import "node-fetch" (Vite resolves it even if branch won't run).
 * - If jsdom penceresinde window.fetch yoksa, Node'un fetch'ini window'a köprüle.
 */
const g = globalThis as any;

if (typeof window !== "undefined") {
    if (!("fetch" in window) && typeof g.fetch === "function") {
        // @ts-ignore
        window.fetch = g.fetch.bind(g);
    }
}

// matchMedia mock
if (!window.matchMedia) {
    // @ts-ignore
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),       // eski API'yi kullanan lib'ler için
        removeListener: vi.fn(),    // eski API'yi kullanan lib'ler için
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}

// createObjectURL mock
if (!window.URL.createObjectURL) {
    // @ts-ignore
    window.URL.createObjectURL = vi.fn();
}

// scrollTo mock
// @ts-ignore
window.scrollTo = vi.fn();

// ResizeObserver mock (bazı UI kütüphaneleri ister)
class RO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
if (!("ResizeObserver" in window)) {
    // @ts-ignore
    window.ResizeObserver = RO as any;
}

const origError = console.error;
vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("XMLHttpRequest")) return; // jsdom gürültüsü
    origError(...args);
});
