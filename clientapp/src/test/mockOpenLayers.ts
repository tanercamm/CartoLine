import { vi } from "vitest";

class BaseLayer {
    setZIndex = vi.fn();
    setVisible = vi.fn();
    getVisible = vi.fn(() => true);
    changed = vi.fn();
}

class Feature {
    _props: Record<string, any>;
    _geom: any;
    constructor(props: any = {}) {
        this._props = { ...props };
        this._geom = props?.geometry ?? null;
    }
    get = vi.fn((k: string) => this._props[k]);
    set = vi.fn((k: string, v: any) => (this._props[k] = v));
    getGeometry = vi.fn(() => this._geom);
    setGeometry = vi.fn((g: any) => (this._geom = g));
}
class Point {
    constructor(public coords: any) { }
}
class Polygon {
    constructor(public coords: any) { }
}
class MultiPolygon {
    constructor(public coords: any) { }
}

class VectorSource {
    _features: any[];
    constructor(opts?: any) {
        this._features = opts?.features ?? [];
    }
    addFeature = vi.fn((f: any) => this._features.push(f));
    addFeatures = vi.fn((fs: any[]) => this._features.push(...fs));
    clear = vi.fn(() => (this._features = []));
    getFeatures = vi.fn(() => this._features);
}
class OSM {
    constructor(_opts?: any) { }
}
class XYZ {
    constructor(_opts?: any) { }
}

class VectorLayer extends BaseLayer {
    _source: any;
    _style: any;
    constructor(opts?: any) {
        super();
        this._source = opts?.source ?? new VectorSource();
        this._style = opts?.style ?? null;
    }
    getSource = vi.fn(() => this._source);
    setSource = vi.fn((s: any) => (this._source = s));
    setStyle = vi.fn((s: any) => (this._style = s));
    getStyle = vi.fn(() => this._style);
}
class TileLayer extends BaseLayer {
    _source: any;
    constructor(opts?: any) {
        super();
        this._source = opts?.source ?? {};
    }
    getSource = vi.fn(() => this._source);
}

class Overlay {
    _element: any;
    _position: any;
    _offset: any;
    constructor(opts: any = {}) {
        this._element = opts.element;
        this._position = opts.position ?? null;
        this._offset = opts.offset ?? [0, 0];
    }
    setPosition = vi.fn((p: any) => (this._position = p));
    getPosition = vi.fn(() => this._position);
    getElement = vi.fn(() => this._element);
    setOffset = vi.fn((o: any) => (this._offset = o));
}

class Map {
    _target: any;
    _view: any;
    _layers: any[];
    _overlays: any[];
    _interactions: any[];
    _controls: any[];

    constructor(opts?: any) {
        this._target = opts?.target ?? null;
        this._view = opts?.view;
        this._layers = opts?.layers ?? [];
        this._overlays = [];
        this._interactions = [];
        this._controls = [];
    }

    setTarget = vi.fn((t?: any) => (this._target = t));
    getTarget = vi.fn(() => this._target);

    getTargetElement = vi.fn(() => {
        if (!this._target) return null;
        return typeof this._target === "string"
            ? (document.getElementById(this._target) as HTMLElement | null)
            : (this._target as HTMLElement);
    });

    getViewport = vi.fn(() => {
        const el = this.getTargetElement();
        return el ?? document.createElement("div");
    });

    addLayer = vi.fn((l: any) => this._layers.push(l));
    getLayers = vi.fn(() => ({ getArray: () => this._layers }));
    getView = vi.fn(() => this._view);

    addOverlay = vi.fn((o: any) => { this._overlays.push(o); });
    removeOverlay = vi.fn((o: any) => { this._overlays = this._overlays.filter(x => x !== o); });
    getOverlays = vi.fn(() => ({ getArray: () => this._overlays }));

    addInteraction = vi.fn((i: any) => { this._interactions.push(i); });
    removeInteraction = vi.fn((i: any) => { this._interactions = this._interactions.filter(x => x !== i); });

    addControl = vi.fn((c: any) => { this._controls.push(c); });
    removeControl = vi.fn((c: any) => { this._controls = this._controls.filter(x => x !== c); });

    on = vi.fn();
    once = vi.fn();
    updateSize = vi.fn();
    dispose = vi.fn();
}

class View {
    _center: any;
    _zoom: number;
    _projection: any;
    constructor(opts?: any) {
        this._center = opts?.center;
        this._zoom = opts?.zoom ?? 0;
        this._projection = opts?.projection ?? { getCode: () => "EPSG:3857" };
    }
    setCenter = vi.fn((c: any) => (this._center = c));
    setZoom = vi.fn((z: number) => (this._zoom = z));
    getZoom = vi.fn(() => this._zoom);
}

class Style { constructor(_opts?: any) { } }
class Fill { constructor(_opts?: any) { } }
class Stroke { constructor(_opts?: any) { } }
class Icon { constructor(_opts?: any) { } }
class Text { constructor(_opts?: any) { } }
class Circle { constructor(_opts?: any) { } }

class GeoJSON {
    readFeatures = vi.fn((_g: any, _opts?: any) => []); // testlerde gerçek parse gerekmiyor
}

vi.mock("ol/proj", () => {
    const fromLonLat = vi.fn((c: any) => c);
    const transformExtent = vi.fn((e: any) => e);
    const transform = vi.fn((c: any) => c);
    const toLonLat = vi.fn((c: any) => c);
    const get = vi.fn((code?: string) => ({
        code: code ?? "EPSG:3857",
        getCode: () => code ?? "EPSG:3857",
    }));
    return { fromLonLat, transformExtent, transform, toLonLat, get };
});
vi.mock("ol/extent", () => ({
    buffer: vi.fn((extent: any, _value: number) => extent),
}));

vi.mock("ol/Map", () => ({ default: Map }));
vi.mock("ol/View", () => ({ default: View }));
vi.mock("ol/Overlay", () => ({ default: Overlay }));

vi.mock("ol/layer/Vector", () => ({ default: VectorLayer }));
vi.mock("ol/layer/Tile", () => ({ default: TileLayer }));

vi.mock("ol/source/Vector", () => ({ default: VectorSource }));
vi.mock("ol/source/OSM", () => ({ default: OSM }));
vi.mock("ol/source/XYZ", () => ({ default: XYZ }));

vi.mock("ol/style/Style", () => ({ default: Style }));
vi.mock("ol/style/Fill", () => ({ default: Fill }));
vi.mock("ol/style/Stroke", () => ({ default: Stroke }));
vi.mock("ol/style/Icon", () => ({ default: Icon }));
vi.mock("ol/style/Text", () => ({ default: Text }));
vi.mock("ol/style/Circle", () => ({ default: Circle }));

vi.mock("ol/Feature", () => ({ default: Feature }));
vi.mock("ol/geom/Point", () => ({ default: Point }));
vi.mock("ol/geom/Polygon", () => ({ default: Polygon }));
vi.mock("ol/geom/MultiPolygon", () => ({ default: MultiPolygon }));

vi.mock("ol/format/GeoJSON", () => ({ default: GeoJSON }));
