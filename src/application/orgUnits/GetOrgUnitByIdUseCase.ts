import { FutureData } from "$/domain/entities/generic/FutureData";
import { Id } from "$/domain/entities/Ref";
import { OrgUnit } from "$/domain/orgUnits/OrgUnit";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";

export class GetOrgUnitByIdUseCase {
    constructor(private options: { orgUnitRepository: OrgUnitRepository }) {}

    execute(id: Id): FutureData<OrgUnit> {
        return this.options.orgUnitRepository.getById(id);
    }
}
