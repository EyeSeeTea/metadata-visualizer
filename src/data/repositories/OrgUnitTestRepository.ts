import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnit, OrgUnitPathSegment } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";

export class OrgUnitTestRepository implements OrgUnitRepository {
    getById(_id: Id): FutureData<OrgUnit> {
        return Future.success({
            id: "testOrgUnit1",
            name: "Test Org Unit",
            shortName: "TestOU",
            displayName: "Test Org Unit",
            path: "/rootId/testOrgUnit1",
            level: 2,
            parent: { id: "rootId", name: "Root" },
        });
    }

    getPathSegments(_ids: Id[]): FutureData<OrgUnitPathSegment[]> {
        return Future.success([
            { id: "rootId", name: "Root", shortName: "Root" },
            { id: "testOrgUnit1", name: "Test Org Unit", shortName: "TestOU" },
        ]);
    }
}
