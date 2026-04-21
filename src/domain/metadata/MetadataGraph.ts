import { Id } from "$/domain/entities/Ref";
import { ResourceType } from "$/domain/metadata/ResourceType";

export type GraphNode = {
    key: string;
    type: ResourceType;
    id: Id;
    displayName: string;
};

export type GraphEdge = {
    from: string;
    to: string;
    label: string;
};

export type GraphGroup = {
    id: string;
    title: string;
    nodeKeys: string[];
    direction: "parent" | "child";
};

export type MetadataGraph = {
    center: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    groups: GraphGroup[];
    lazy?: {
        categoryOptionCombos?: {
            categoryComboId: Id;
        };
    };
};

export function graphNodeKey(type: ResourceType, id: Id): string {
    return `${type}:${id}`;
}
