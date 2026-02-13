import type { DataEngine } from "./types/dhis2-app-runtime";
import { BuildMetadataGraphUseCase } from "./application/metadata/BuildMetadataGraphUseCase";
import { ListCategoryOptionCombosUseCase } from "./application/metadata/ListCategoryOptionCombosUseCase";
import { ListMetadataUseCase } from "./application/metadata/ListMetadataUseCase";
import { GetUiLocaleUseCase } from "./application/system/GetUiLocaleUseCase";
import { GetCurrentUserUseCase } from "./application/users/GetCurrentUserUseCase";
import { MetadataDhis2Repository } from "./data/repositories/MetadataDhis2Repository";
import { MetadataTestRepository } from "./data/repositories/MetadataTestRepository";
import { SystemDhis2Repository } from "./data/repositories/SystemDhis2Repository";
import { SystemTestRepository } from "./data/repositories/SystemTestRepository";
import { UserDhis2Repository } from "./data/repositories/UserDhis2Repository";
import { UserTestRepository } from "./data/repositories/UserTestRepository";
import { MetadataRepository } from "./domain/repositories/MetadataRepository";
import { SystemRepository } from "./domain/repositories/SystemRepository";
import { UserRepository } from "./domain/repositories/UserRepository";

export type CompositionRoot = ReturnType<typeof getCompositionRoot>;

type Repositories = {
    userRepository: UserRepository;
    metadataRepository: MetadataRepository;
    systemRepository: SystemRepository;
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
            listCategoryOptionCombos: new ListCategoryOptionCombosUseCase(repositories),
        },
    };
}

export function getWebappCompositionRoot(dataEngine: DataEngine) {
    const repositories: Repositories = {
        userRepository: new UserDhis2Repository(dataEngine),
        metadataRepository: new MetadataDhis2Repository(dataEngine),
        systemRepository: new SystemDhis2Repository(dataEngine),
    };

    return getCompositionRoot(repositories);
}

export function getTestCompositionRoot() {
    const repositories: Repositories = {
        userRepository: new UserTestRepository(),
        metadataRepository: new MetadataTestRepository(),
        systemRepository: new SystemTestRepository(),
    };

    return getCompositionRoot(repositories);
}
