import type { DataEngine } from "$/types/dhis2-app-runtime";
import { MetadataDhis2Repository } from "$/data/repositories/MetadataDhis2Repository";
import { MetadataTestRepository } from "$/data/repositories/MetadataTestRepository";
import { OrgUnitDhis2Repository } from "$/data/repositories/OrgUnitDhis2Repository";
import { OrgUnitTestRepository } from "$/data/repositories/OrgUnitTestRepository";
import { SystemDhis2Repository } from "$/data/repositories/SystemDhis2Repository";
import { SystemTestRepository } from "$/data/repositories/SystemTestRepository";
import { UserDhis2Repository } from "$/data/repositories/UserDhis2Repository";
import { UserTestRepository } from "$/data/repositories/UserTestRepository";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";
import { OrgUnitRepository } from "$/domain/repositories/OrgUnitRepository";
import { SystemRepository } from "$/domain/repositories/SystemRepository";
import { UserRepository } from "$/domain/repositories/UserRepository";
import { BuildJsonPackageDependencyGraphUseCase } from "$/domain/usecases/metadata/BuildJsonPackageDependencyGraphUseCase";
import { BuildMetadataGraphUseCase } from "$/domain/usecases/metadata/BuildMetadataGraphUseCase";
import { ListCategoryOptionCombosUseCase } from "$/domain/usecases/metadata/ListCategoryOptionCombosUseCase";
import { ListMetadataUseCase } from "$/domain/usecases/metadata/ListMetadataUseCase";
import { GetOrgUnitByIdUseCase } from "$/domain/usecases/orgUnits/GetOrgUnitByIdUseCase";
import { GetOrgUnitPathInfoUseCase } from "$/domain/usecases/orgUnits/GetOrgUnitPathInfoUseCase";
import { GetUiLocaleUseCase } from "$/domain/usecases/system/GetUiLocaleUseCase";
import { GetCurrentUserUseCase } from "$/domain/usecases/users/GetCurrentUserUseCase";

export type CompositionRoot = ReturnType<typeof getCompositionRoot>;

type Repositories = {
    userRepository: UserRepository;
    metadataRepository: MetadataRepository;
    systemRepository: SystemRepository;
    orgUnitRepository: OrgUnitRepository;
};

function getCompositionRoot(repositories: Repositories) {
    return {
        users: {
            getCurrent: new GetCurrentUserUseCase(repositories),
        },
        system: {
            getUiLocale: new GetUiLocaleUseCase(repositories),
        },
        metadata: {
            list: new ListMetadataUseCase(repositories),
            graph: new BuildMetadataGraphUseCase(repositories),
            jsonPackageGraph: new BuildJsonPackageDependencyGraphUseCase(),
            listCategoryOptionCombos: new ListCategoryOptionCombosUseCase(repositories),
        },
        orgUnits: {
            getById: new GetOrgUnitByIdUseCase(repositories),
            getPathInfo: new GetOrgUnitPathInfoUseCase(repositories),
        },
    };
}

export function getWebappCompositionRoot(dataEngine: DataEngine) {
    const repositories: Repositories = {
        userRepository: new UserDhis2Repository(dataEngine),
        metadataRepository: new MetadataDhis2Repository(dataEngine),
        systemRepository: new SystemDhis2Repository(dataEngine),
        orgUnitRepository: new OrgUnitDhis2Repository(dataEngine),
    };

    return getCompositionRoot(repositories);
}

export function getTestCompositionRoot() {
    const repositories: Repositories = {
        userRepository: new UserTestRepository(),
        metadataRepository: new MetadataTestRepository(),
        systemRepository: new SystemTestRepository(),
        orgUnitRepository: new OrgUnitTestRepository(),
    };

    return getCompositionRoot(repositories);
}
