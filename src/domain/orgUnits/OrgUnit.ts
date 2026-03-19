import { Id } from "$/domain/entities/Ref";

export type OrgUnit = {
    id: Id;
    name: string;
    shortName: string;
    displayName: string;
    path: string;
    level: number;
    openingDate?: string;
    closedDate?: string;
    coordinates?: Coordinates;
    geometry?: OrgUnitGeometry;
    parent?: { id: Id; name: string };
};

export type Coordinates = {
    latitude: number;
    longitude: number;
};

export type OrgUnitGeometry = {
    type: "Point" | "Polygon" | "MultiPolygon";
    coordinates: unknown;
};

export type OrgUnitPathInfo = {
    path: string;
    pathWithNames: string;
    pathWithShortNames: string;
};

export type OrgUnitPathSegment = {
    id: Id;
    name: string;
    shortName: string;
};

export function extractIdsFromPath(path: string): Id[] {
    return path.split("/").filter(segment => segment.length > 0);
}

export function buildPathInfo(path: string, segments: OrgUnitPathSegment[]): OrgUnitPathInfo {
    const ids = extractIdsFromPath(path);
    const segmentById = new Map(segments.map(s => [s.id, s]));

    const pathWithNames = ids
        .map(id => segmentById.get(id)?.name ?? id)
        .join(" / ");

    const pathWithShortNames = ids
        .map(id => segmentById.get(id)?.shortName ?? id)
        .join(" / ");

    return { path, pathWithNames, pathWithShortNames };
}

export type LngLatCoord = [number, number];

export function extractPolygons(geometry: OrgUnitGeometry): LngLatCoord[][] {
    switch (geometry.type) {
        case "Polygon":
            return geometry.coordinates as LngLatCoord[][];
        case "MultiPolygon":
            return (geometry.coordinates as LngLatCoord[][][]).flat();
        default:
            return [];
    }
}

export function getGeographicCenter(
    orgUnit: OrgUnit
): { center: [number, number]; hasData: boolean } {
    const geometry = orgUnit.geometry;
    const coordinates = orgUnit.coordinates;

    if (geometry) {
        if (geometry.type === "Point") {
            const [lng, lat] = geometry.coordinates as [number, number];
            return { center: [lat, lng], hasData: true };
        }

        const polygons = extractPolygons(geometry);
        const allPoints = polygons.flat();

        if (allPoints.length > 0) {
            const lngs = allPoints.map(p => p[0]);
            const lats = allPoints.map(p => p[1]);
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            return { center: [centerLat, centerLng], hasData: true };
        }
    }

    if (coordinates) {
        return { center: [coordinates.latitude, coordinates.longitude], hasData: true };
    }

    return { center: [0, 0], hasData: false };
}
