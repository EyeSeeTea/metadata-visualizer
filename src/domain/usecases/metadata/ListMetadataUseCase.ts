import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

export class ListMetadataUseCase {
    constructor(private options: { metadataRepository: MetadataRepository }) {}

    public execute(query: MetadataQuery): FutureData<MetadataList> {
        return this.options.metadataRepository.list(query);
    }
}
