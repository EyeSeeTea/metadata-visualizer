import { FutureData } from "$/domain/entities/generic/FutureData";
import { OrgUnitPathInfo, extractIdsFromPath, buildPathInfo } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";

export class GetOrgUnitPathInfoUseCase {
    constructor(private options: { orgUnitRepository: OrgUnitRepository }) {}

    execute(path: string): FutureData<OrgUnitPathInfo> {
        const ids = extractIdsFromPath(path);

        return this.options.orgUnitRepository
            .getPathSegments(ids)
            .map(segments => buildPathInfo(path, segments));
    }
}
