import { getMetadataTypeLabel } from "$/domain/metadata/ResourceType";
import { MetadataGraph } from "$/domain/metadata/MetadataGraph";
import {
    JsonPackageEntry,
    JsonPackageGraphMode,
    JsonPackageIncomingReference,
    JsonPackageIndex,
    JsonPackageReference,
    compareTypeNames,
    getTypePriority,
    graphPolicyByCenterType,
} from "$/domain/metadata/JsonPackageIndex";

type BuildJsonPackageGraphOptions = Readonly<{
    maxNodes?: number;
    mode?: JsonPackageGraphMode;
}>;

type TraversalOutgoingRef = {
    ref: JsonPackageReference;
    toEntry: JsonPackageEntry;
};

type TraversalIncomingRef = {
    ref: JsonPackageIncomingReference;
    fromEntry: JsonPackageEntry;
};

export class BuildJsonPackageDependencyGraphUseCase {
    execute(
        index: JsonPackageIndex,
        centerKey: string,
        options: number | BuildJsonPackageGraphOptions = Number.POSITIVE_INFINITY
    ): MetadataGraph {
        const centerEntry = index.entriesByKey.get(centerKey);
        if (!centerEntry) {
            throw new Error(`Metadata item not found: ${centerKey}`);
        }
        const centerType = centerEntry.type;
        const maxNodes =
            typeof options === "number" ? options : options.maxNodes ?? Number.POSITIVE_INFINITY;
        const mode: JsonPackageGraphMode =
            typeof options === "number" ? "expanded" : options.mode ?? "expanded";

        const visitedKeys = new Set<string>([centerKey]);
        const graphEdges = new Map<string, { from: string; to: string; label: string }>();

        const addNodeToGraph = (nextKey: string): boolean => {
            if (visitedKeys.size >= maxNodes) return false;
            if (visitedKeys.has(nextKey)) return false;
            visitedKeys.add(nextKey);
            return true;
        };

        const addRefsForNode = (fromKey: string, onNewNode?: (key: string) => void) => {
            const refs = sortOutgoingRefsForTraversal(
                index.refsByKey.get(fromKey) ?? [],
                index,
                centerType,
                centerKey
            );
            refs.forEach(({ ref }) => {
                const edgeKey = `${fromKey}|${ref.toKey}|${ref.via}`;
                if (!graphEdges.has(edgeKey)) {
                    graphEdges.set(edgeKey, { from: fromKey, to: ref.toKey, label: ref.via });
                }
                if (addNodeToGraph(ref.toKey)) {
                    onNewNode?.(ref.toKey);
                }
            });

            const currentType = index.entriesByKey.get(fromKey)?.type;
            if (currentType && shouldSkipIncomingForCurrentType(centerType, currentType)) {
                return;
            }

            sortIncomingRefsForTraversal(
                index.incomingRefsByKey.get(fromKey) ?? [],
                index,
                centerType,
                centerKey
            ).forEach(({ ref }) => {
                const edgeKey = `${ref.fromKey}|${fromKey}|${ref.via}`;
                if (!graphEdges.has(edgeKey)) {
                    graphEdges.set(edgeKey, { from: ref.fromKey, to: fromKey, label: ref.via });
                }
                if (addNodeToGraph(ref.fromKey)) {
                    onNewNode?.(ref.fromKey);
                }
            });
        };

        if (mode === "direct") {
            addRefsForNode(centerKey);
        } else {
            const queue = [centerKey];

            while (queue.length > 0) {
                const fromKey = queue.shift();
                if (!fromKey) continue;
                addRefsForNode(fromKey, key => {
                    if (key === centerKey) return;
                    queue.push(key);
                });
            }
        }

        const nodes = Array.from(visitedKeys)
            .map(key => index.entriesByKey.get(key))
            .filter((entry): entry is JsonPackageEntry => Boolean(entry))
            .map(entry => ({
                key: entry.key,
                id: entry.id,
                type: entry.type,
                displayName: entry.displayName,
            }));

        const keyToNodeKey = new Map<string, string>();
        Array.from(visitedKeys).forEach(key => {
            const entry = index.entriesByKey.get(key);
            if (!entry) return;
            keyToNodeKey.set(key, entry.key);
        });

        const edges = Array.from(graphEdges.values())
            .map(edge => {
                const from = keyToNodeKey.get(edge.from);
                const to = keyToNodeKey.get(edge.to);
                if (!from || !to) return null;
                return { from, to, label: edge.label };
            })
            .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));

        const centerNodeKey = keyToNodeKey.get(centerKey) ?? centerEntry.key;
        const groups = buildTypeGroups(index, visitedKeys, centerKey, keyToNodeKey);

        return { center: centerNodeKey, nodes, edges, groups };
    }
}

function sortOutgoingRefsForTraversal(
    refs: JsonPackageReference[],
    index: JsonPackageIndex,
    centerType: string,
    centerKey: string
): TraversalOutgoingRef[] {
    return refs
        .map(ref => {
            const toEntry = index.entriesByKey.get(ref.toKey);
            if (!toEntry) return null;
            if (!shouldIncludeTypeForCenter(centerType, toEntry.type)) return null;
            if (toEntry.type === centerType && ref.toKey !== centerKey) return null;
            return { ref, toEntry };
        })
        .filter((item): item is TraversalOutgoingRef => Boolean(item))
        .sort((a, b) => compareEntriesForTraversal(a.toEntry, b.toEntry, centerType));
}

function sortIncomingRefsForTraversal(
    refs: JsonPackageIncomingReference[],
    index: JsonPackageIndex,
    centerType: string,
    centerKey: string
): TraversalIncomingRef[] {
    return refs
        .map(ref => {
            const fromEntry = index.entriesByKey.get(ref.fromKey);
            if (!fromEntry) return null;
            if (!shouldIncludeTypeForCenter(centerType, fromEntry.type)) return null;
            if (fromEntry.type === centerType && ref.fromKey !== centerKey) return null;
            return { ref, fromEntry };
        })
        .filter((item): item is TraversalIncomingRef => Boolean(item))
        .sort((a, b) => compareEntriesForTraversal(a.fromEntry, b.fromEntry, centerType));
}

function buildTypeGroups(
    index: JsonPackageIndex,
    visitedKeys: Set<string>,
    centerKey: string,
    keyToNodeKey: Map<string, string>
) {
    const centerType = index.entriesByKey.get(centerKey)?.type;
    const groupsByType = new Map<string, string[]>();

    Array.from(visitedKeys).forEach(key => {
        if (key === centerKey) return;
        const entry = index.entriesByKey.get(key);
        const nodeKey = keyToNodeKey.get(key);
        if (!entry || !nodeKey) return;
        if (entry.type === centerType) return;

        const nodes = groupsByType.get(entry.type) ?? [];
        groupsByType.set(entry.type, [...nodes, nodeKey]);
    });

    return Array.from(groupsByType.entries())
        .sort(([a], [b]) => compareTypeNamesForCenter(a, b, centerType))
        .map(([type, nodeKeys]) => ({
            id: `json-type:${type}`,
            title: getMetadataTypeLabel(type),
            nodeKeys,
            direction: resolveGroupDirection(type, centerType),
        }));
}

function resolveGroupDirection(type: string, centerType?: string): "parent" | "child" {
    if (!centerType) return "child";

    const typePriority = getTypePriority(type);
    const centerPriority = getTypePriority(centerType);
    return typePriority < centerPriority ? "parent" : "child";
}

function compareEntriesForTraversal(
    a: JsonPackageEntry,
    b: JsonPackageEntry,
    centerType: string
): number {
    const typeDiff = compareTypeNamesForCenter(a.type, b.type, centerType);
    if (typeDiff !== 0) return typeDiff;

    const nameDiff = a.displayName.localeCompare(b.displayName);
    if (nameDiff !== 0) return nameDiff;

    return a.id.localeCompare(b.id);
}

function compareTypeNamesForCenter(a: string, b: string, centerType?: string): number {
    const related = centerType ? getRelatedTypesForCenter(centerType) : [];
    const aIndex = related.indexOf(a);
    const bIndex = related.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        if (aIndex !== bIndex) return aIndex - bIndex;
    }

    return compareTypeNames(a, b);
}

function shouldIncludeTypeForCenter(centerType: string, candidateType: string): boolean {
    const related = getRelatedTypesForCenter(centerType);
    if (!related.length) return true;
    return candidateType === centerType || related.includes(candidateType);
}

function shouldSkipIncomingForCurrentType(centerType: string, currentType: string): boolean {
    const skipIncoming = graphPolicyByCenterType[centerType]?.noIncomingFromTypes ?? [];
    return skipIncoming.includes(currentType);
}

function getRelatedTypesForCenter(centerType: string): readonly string[] {
    return graphPolicyByCenterType[centerType]?.relatedTypes ?? [];
}
