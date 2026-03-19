import { ResourceType } from "$/domain/metadata/ResourceType";

export type MetadataQuery = {
    type: ResourceType;
    fields: string;
    filters?: string[];
    page?: number;
    pageSize?: number;
    paging?: boolean;
};
