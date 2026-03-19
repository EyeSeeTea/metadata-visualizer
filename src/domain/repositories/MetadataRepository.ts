import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";

export interface MetadataRepository {
    list(query: MetadataQuery): FutureData<MetadataList>;
    get(type: ResourceType, id: string, fields: string): FutureData<MetadataItem>;
}
