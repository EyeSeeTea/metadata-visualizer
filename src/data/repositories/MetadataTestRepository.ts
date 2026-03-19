import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

export class MetadataTestRepository implements MetadataRepository {
    public list(_query: MetadataQuery): FutureData<MetadataList> {
        return Future.success({
            items: [],
            pager: { page: 1, pageSize: 1, pageCount: 1, total: 0 },
        });
    }

    public get(type: ResourceType, id: string, _fields: string): FutureData<MetadataItem> {
        return Future.success({ type, id, displayName: id });
    }
}
