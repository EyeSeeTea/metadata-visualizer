import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

export class MetadataDhis2Repository implements MetadataRepository {
    constructor(private dataEngine: DataEngine) {}

    public list(query: MetadataQuery): FutureData<MetadataList> {
        return promiseToFuture<MetadataList>(signal =>
            this.dataEngine
                .query(
                    {
                        items: {
                            resource: query.type,
                            params: buildParams(query),
                        },
                    },
                    { signal }
                )
                .then(res =>
                    toMetadataList((res as { items: Dhis2ListResponse }).items, query.type)
                )
        );
    }

    public get(type: ResourceType, id: string, fields: string): FutureData<MetadataItem> {
        return promiseToFuture<MetadataItem>(signal =>
            this.dataEngine
                .query(
                    {
                        item: {
                            resource: type,
                            id,
                            params: { fields },
                        },
                    },
                    { signal }
                )
                .then(res => ({ ...(res as { item: MetadataItem }).item, type }))
        );
    }
}

type Dhis2ListResponse = {
    pager?: MetadataList["pager"];
    [key: string]: unknown;
};

function buildParams(query: MetadataQuery): Dhis2QueryParameters {
    const params: Dhis2QueryParameters = {
        fields: query.fields,
    };

    if (query.filters && query.filters.length > 0) {
        params.filter = query.filters.length === 1 ? query.filters[0] : query.filters;
    }

    if (typeof query.page === "number") {
        params.page = query.page;
    }

    if (typeof query.pageSize === "number") {
        params.pageSize = query.pageSize;
    }

    if (typeof query.paging === "boolean") {
        params.paging = query.paging;
    }

    return params;
}

type Dhis2QueryParameterPrimitive = string | number | boolean;
type Dhis2QueryParameterAlias = { [name: string]: Dhis2QueryParameterPrimitive };
type Dhis2QueryParameterValue =
    | Dhis2QueryParameterPrimitive
    | Dhis2QueryParameterAlias
    | Array<Dhis2QueryParameterPrimitive | Dhis2QueryParameterAlias>
    | undefined;
type Dhis2QueryParameters = {
    pageSize?: number;
    [key: string]: Dhis2QueryParameterValue;
};

function toMetadataList(payload: Dhis2ListResponse, type: ResourceType): MetadataList {
    const items = Array.isArray(payload[type]) ? (payload[type] as MetadataItem[]) : [];
    return {
        items: items.map(item => ({ ...item, type })),
        pager: payload.pager,
    };
}
