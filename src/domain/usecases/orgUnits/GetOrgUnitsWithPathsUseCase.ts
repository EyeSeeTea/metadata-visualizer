import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnitWithPath, buildPathInfo, extractIdsFromPath } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";

export class GetOrgUnitsWithPathsUseCase {
    constructor(private options: { orgUnitRepository: OrgUnitRepository }) {}

    execute(ids: Id[]): FutureData<OrgUnitWithPath[]> {
        const uniqueIds = [...new Set(ids)];

        return this.options.orgUnitRepository.getByIds(uniqueIds).flatMap(orgUnits => {
            const pathIds = [
                ...new Set(orgUnits.flatMap(orgUnit => extractIdsFromPath(orgUnit.path))),
            ];

            return this.options.orgUnitRepository.getPathSegments(pathIds).map(segments => {
                const withPaths = orgUnits.map(
                    (orgUnit): OrgUnitWithPath => ({
                        orgUnit,
                        pathInfo: buildPathInfo(orgUnit.path, segments),
                    })
                );

                return sortByPath(withPaths);
            });
        });
    }
}

function sortByPath(items: OrgUnitWithPath[]): OrgUnitWithPath[] {
    return [...items].sort((a, b) => a.orgUnit.path.localeCompare(b.orgUnit.path));
}
