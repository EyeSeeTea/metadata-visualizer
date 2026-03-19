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
