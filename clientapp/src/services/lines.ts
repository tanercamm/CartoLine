export type ApiResponse<T> = {
    success: boolean;
    message?: string;
    data?: T;
};

export type LineDto = {
    id: number;
    name: string;
    lineWkt: string;
    type?: string;
};

const BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt}`);
    }
    const body = (await res.json()) as ApiResponse<T>;
    if (!body.success) {
        throw new Error(body.message || "API error");
    }
    return body.data as T;
}

export function getLines(): Promise<LineDto[]> {
    return api<LineDto[]>("/api/line");
}

export function createLine(input: { name: string; lineWkt: string; type?: string }): Promise<boolean> {
    return api<boolean>("/api/line", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
