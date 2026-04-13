import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import {
    Dhis2PayloadError,
    assertGetEnvelope,
    assertListEnvelope,
    assertMetadataItem,
    assertMetadataItems,
    parsePager,
} from "$/data/dhis2-payload-guards";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

export class MetadataDhis2Repository implements MetadataRepository {
    constructor(private dataEngine: DataEngine) {}

    public list(query: MetadataQuery): FutureData<MetadataList> {
        const context = `MetadataDhis2Repository.list(${query.type})`;
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
                .then(res => toMetadataList(res, query.type, context))
        );
    }

    public get(type: ResourceType, id: string, fields: string): FutureData<MetadataItem> {
        const context = `MetadataDhis2Repository.get(${type}, ${id})`;
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
                .then(res => {
                    const envelope = assertGetEnvelope(res, context);
                    const item = assertMetadataItem(envelope.item, `${context}.item`);
                    return { ...item, type };
                })
        );
    }
}

type Dhis2QueryParameterPrimitive = string | number | boolean;
type Dhis2QueryParameterAlias = { [name: string]: Dhis2QueryParameterPrimitive };
type Dhis2QueryParameterValue =
    | Dhis2QueryParameterPrimitive
    | Dhis2QueryParameterAlias
    | Array<Dhis2QueryParameterPrimitive | Dhis2QueryParameterAlias>
    | undefined;
type Dhis2QueryParameters = Record<string, Dhis2QueryParameterValue>;

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

function toMetadataList(response: unknown, type: ResourceType, context: string): MetadataList {
    const envelope = assertListEnvelope(response, context);
    const rawItems = envelope.items[type];
    if (rawItems === undefined) {
        throw new Dhis2PayloadError(`${context}: payload is missing "${type}" collection`);
    }
    const items = assertMetadataItems(rawItems, `${context}.items.${type}`);
    return {
        items: items.map(item => ({ ...item, type })),
        pager: parsePager(envelope.items.pager),
    };
}
