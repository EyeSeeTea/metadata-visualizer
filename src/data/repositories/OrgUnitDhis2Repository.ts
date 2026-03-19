import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnit, OrgUnitPathSegment } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";

export class OrgUnitDhis2Repository implements OrgUnitRepository {
    constructor(private dataEngine: DataEngine) {}

    getById(id: Id): FutureData<OrgUnit> {
        return promiseToFuture<OrgUnit>(signal =>
            this.dataEngine
                .query(
                    {
                        orgUnit: {
                            resource: "organisationUnits",
                            id,
                            params: {
                                fields: orgUnitFields,
                            },
                        },
                    },
                    { signal }
                )
                .then(res => toOrgUnit((res as { orgUnit: Dhis2OrgUnit }).orgUnit))
        );
    }

    getPathSegments(ids: Id[]): FutureData<OrgUnitPathSegment[]> {
        if (ids.length === 0) {
            return promiseToFuture(() => Promise.resolve([]));
        }

        const filter = `id:in:[${ids.join(",")}]`;

        return promiseToFuture<OrgUnitPathSegment[]>(signal =>
            this.dataEngine
                .query(
                    {
                        orgUnits: {
                            resource: "organisationUnits",
                            params: {
                                fields: "id,name,shortName",
                                filter,
                                paging: false,
                            },
                        },
                    },
                    { signal }
                )
                .then(res => {
                    const data = res as { orgUnits: { organisationUnits: Dhis2PathSegment[] } };
                    return data.orgUnits.organisationUnits.map(ou => ({
                        id: ou.id,
                        name: ou.name,
                        shortName: ou.shortName,
                    }));
                })
        );
    }
}

const orgUnitFields = [
    "id",
    "name",
    "shortName",
    "displayName",
    "path",
    "level",
    "openingDate",
    "closedDate",
    "coordinates",
    "geometry",
    "parent[id,name]",
].join(",");

type Dhis2OrgUnit = {
    id: string;
    name: string;
    shortName: string;
    displayName: string;
    path: string;
    level: number;
    openingDate?: string;
    closedDate?: string;
    coordinates?: string;
    geometry?: { type: string; coordinates: unknown };
    parent?: { id: string; name: string };
};

type Dhis2PathSegment = {
    id: string;
    name: string;
    shortName: string;
};

function toOrgUnit(raw: Dhis2OrgUnit): OrgUnit {
    const coords = parseCoordinates(raw.coordinates);

    return {
        id: raw.id,
        name: raw.name,
        shortName: raw.shortName,
        displayName: raw.displayName,
        path: raw.path,
        level: raw.level,
        openingDate: raw.openingDate,
        closedDate: raw.closedDate,
        coordinates: coords,
        geometry: raw.geometry
            ? {
                  type: raw.geometry.type as OrgUnit["geometry"] extends infer G
                      ? G extends { type: infer T }
                          ? T
                          : never
                      : never,
                  coordinates: raw.geometry.coordinates,
              }
            : undefined,
        parent: raw.parent,
    };
}

function parseCoordinates(raw?: string): OrgUnit["coordinates"] | undefined {
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 2) {
            const [lng, lat] = parsed as [number, number];
            if (typeof lat === "number" && typeof lng === "number") {
                return { latitude: lat, longitude: lng };
            }
        }
    } catch {
        // ignore
    }
    return undefined;
}
