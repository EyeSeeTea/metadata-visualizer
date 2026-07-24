import { describe, expect, it } from "vitest";
import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnit, OrgUnitPathSegment, OrgUnitWithPath } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";
import { GetOrgUnitsWithPathsUseCase } from "$/domain/usecases/orgUnits/GetOrgUnitsWithPathsUseCase";

const segments: OrgUnitPathSegment[] = [
    { id: "root", name: "Sierra Leone", shortName: "SL" },
    { id: "bo", name: "Bo", shortName: "Bo" },
    { id: "bombali", name: "Bombali", shortName: "Bomb" },
    { id: "badjia", name: "Badjia", shortName: "Bad" },
];

const orgUnitBadjia: OrgUnit = {
    id: "badjia",
    name: "Badjia",
    shortName: "Bad",
    displayName: "Badjia",
    path: "/root/bo/badjia",
    level: 3,
};

const orgUnitBombali: OrgUnit = {
    id: "bombali",
    name: "Bombali",
    shortName: "Bomb",
    displayName: "Bombali",
    path: "/root/bombali",
    level: 2,
};

class FakeOrgUnitRepository implements OrgUnitRepository {
    constructor(private orgUnits: OrgUnit[], private segments: OrgUnitPathSegment[]) {}

    getByIds(_ids: Id[]): FutureData<OrgUnit[]> {
        return Future.success(this.orgUnits);
    }

    getPathSegments(_ids: Id[]): FutureData<OrgUnitPathSegment[]> {
        return Future.success(this.segments);
    }
}

function buildUseCase(orgUnits: OrgUnit[], segs: OrgUnitPathSegment[] = segments) {
    return new GetOrgUnitsWithPathsUseCase({
        orgUnitRepository: new FakeOrgUnitRepository(orgUnits, segs),
    });
}

async function executeSingle(
    useCase: GetOrgUnitsWithPathsUseCase,
    ids: Id[]
): Promise<OrgUnitWithPath> {
    const [item] = await useCase.execute(ids).toPromise();
    if (!item) throw new Error("Expected at least one org unit");
    return item;
}

describe("GetOrgUnitsWithPathsUseCase", () => {
    it("sorts the results by the raw UID path", async () => {
        const useCase = buildUseCase([orgUnitBadjia, orgUnitBombali]);

        const items = await useCase.execute(["badjia", "bombali"]).toPromise();

        expect(items.map(item => item.orgUnit.id)).toEqual(["badjia", "bombali"]);
    });

    it("builds ordered path segments with name and id for each org unit", async () => {
        const useCase = buildUseCase([orgUnitBadjia]);

        const item = await executeSingle(useCase, ["badjia"]);

        expect(item.pathInfo.segments).toEqual([
            { id: "root", name: "Sierra Leone", shortName: "SL" },
            { id: "bo", name: "Bo", shortName: "Bo" },
            { id: "badjia", name: "Badjia", shortName: "Bad" },
        ]);
        expect(item.pathInfo.pathWithNames).toEqual("Sierra Leone / Bo / Badjia");
    });

    it("falls back to the id when a segment name is not resolved", async () => {
        const useCase = buildUseCase(
            [orgUnitBadjia],
            [{ id: "root", name: "Sierra Leone", shortName: "SL" }]
        );

        const item = await executeSingle(useCase, ["badjia"]);

        expect(item.pathInfo.segments).toEqual([
            { id: "root", name: "Sierra Leone", shortName: "SL" },
            { id: "bo", name: "bo", shortName: "bo" },
            { id: "badjia", name: "badjia", shortName: "badjia" },
        ]);
    });
});
