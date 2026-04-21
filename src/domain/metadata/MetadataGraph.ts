import { Id } from "$/domain/entities/Ref";

export type GraphNode = {
    key: string;
    type: string;
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

export function graphNodeKey(type: string, id: Id): string {
    return `${type}:${id}`;
}
