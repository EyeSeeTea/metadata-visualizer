import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnit, OrgUnitPathSegment } from "$/domain/orgUnits/OrgUnit";

export interface OrgUnitRepository {
    getById(id: Id): FutureData<OrgUnit>;
    getPathSegments(ids: Id[]): FutureData<OrgUnitPathSegment[]>;
}
