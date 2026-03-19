import { Id } from "$/domain/entities/Ref";
import { ResourceType } from "$/domain/metadata/ResourceType";

export type MetadataItem = {
    type: ResourceType;
    id: Id;
    displayName?: string;
    name?: string;
    [key: string]: unknown;
};

export type MetadataList = {
    items: MetadataItem[];
    pager?: {
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
    };
};
