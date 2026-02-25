import { MetadataGraph } from "$/domain/metadata/MetadataGraph";
import { getMetadataTypeLabel } from "$/domain/metadata/ResourceType";

type JsonRecord = Record<string, unknown>;

const typePriorityOrder = [
    "attributes",
    "categoryOptionGroupSets",
    "categoryOptionGroups",
    "categoryOptionCombos",
    "categoryOptions",
    "categoryCombos",
    "categories",
    "dataElementGroups",
    "dataElements",
    "indicatorTypes",
    "indicatorGroups",
    "indicators",
    "sections",
    "dataSets",
    "validationRuleGroups",
    "visualizations",
    "dashboards",
    "maps",
    "legendSets",
    "userGroups",
    "userRoles",
    "users",
];

const coreMetadataTypes = [
    "categories",
    "categoryCombos",
    "categoryOptions",
    "categoryOptionCombos",
    "categoryOptionGroups",
    "categoryOptionGroupSets",
    "dataElements",
    "dataElementGroups",
    "dataSets",
    "sections",
    "indicatorTypes",
    "indicatorGroups",
    "indicators",
    "legendSets",
    "visualizations",
    "dashboards",
    "maps",
    "validationRuleGroups",
] as const;

const securityMetadataTypes = ["userGroups", "userRoles", "users"] as const;

type JsonTypeGraphPolicy = {
    relatedTypes: string[];
    noIncomingFromTypes?: string[];
};

// Initial policy for the JSON package tab.
// It defines the expected neighborhood for each center type and the preferred display order.
// Unknown types fallback to dynamic behavior.
const graphPolicyByCenterType: Record<string, JsonTypeGraphPolicy> = {
    attributes: {
        relatedTypes: unique([
            ...coreMetadataTypes,
            ...securityMetadataTypes,
            "attributes",
        ]),
    },
    categories: {
        relatedTypes: [
            "categoryCombos",
            "categoryOptions",
            "categoryOptionCombos",
            "categoryOptionGroups",
            "categoryOptionGroupSets"
        ],
    },
    categoryCombos: {
        relatedTypes: [
            "dataSets",
            "dataElements",
            "categoryOptionCombos",
            "categoryOptions",
            "categories",
        ],
    },
    categoryOptionCombos: {
        relatedTypes: [
            "categoryCombos",
            "categories",
            "categoryOptions",
            "dataElements"
        ],
    },
    categoryOptionGroupSets: {
        relatedTypes: [
            "categoryOptions",
            "categories",
            "categoryCombos"
        ],
    },
    categoryOptionGroups: {
        relatedTypes: [
            "categoryOptions",
            "categories",
            "categoryOptionGroupSets",
        ],
    },
    categoryOptions: {
        relatedTypes: [
            "categoryCombos",
            "categories",
            "categoryOptionCombos",
            "categoryOptionGroups",
            "categoryOptionGroupSets",
            "dataElements"
        ],
    },
    dashboards: {
        relatedTypes: [
            "visualizations",
            "maps",
            "indicators",
            "indicatorGroups"
        ],
        noIncomingFromTypes: [
            "indicatorTypes",
        ],
    },
    dataElementGroups: {
        relatedTypes: [
            "dataElements"
        ],
    },
    dataElements: {
        relatedTypes: [
            "dataElementGroups",
            "dataSets",
            "sections",
            "programs",
            "programStages",
            "categoryCombos",
            "categories"
        ],
    },
    dataSets: {
        relatedTypes: [
            "sections",
            "dataElements",
            "dataElementGroups",
            "categoryCombos",
            "categories"
        ],
        noIncomingFromTypes: [
            "categoryCombos",
            "categories",
            "categoryOptions",
            "categoryOptionCombos",
        ],
    },
    indicatorGroups: {
        relatedTypes: [
            "indicators",
            "indicatorTypes",
        ],
    },
    indicatorTypes: {
        relatedTypes: [
            "indicators",
            "indicatorGroups",
            "visualizations",
            "maps",
            "dashboards"
        ],
    },
    indicators: {
        relatedTypes: [
            "indicatorTypes",
            "indicatorGroups",
            "visualizations",
            "maps",
            "dashboards"
        ],
    },
    legendSets: {
        relatedTypes: [
            "visualizations",
            "maps"
        ],
    },
    maps: {
        relatedTypes: [
            "legendSets",
            "visualizations",
            "dashboards",
        ],
    },
    sections: {
        relatedTypes: [
            "dataSets",
            "dataElements",
            "dataElementGroups",
            "categoryCombos",
            "categories",
            "categoryOptions",
            "categoryOptionCombos",
            "indicators",
        ],
    },
    userGroups: {
        relatedTypes: unique([
            ...securityMetadataTypes,
            "users",
            "userRoles"
        ]),
    },
    userRoles: {
        relatedTypes: unique([
            ...securityMetadataTypes,
            "users",
            "userGroups"
        ]),
    },
    users: {
        relatedTypes: unique([
            ...securityMetadataTypes,
            "userRoles",
            "userGroups"
        ]),
    },
    validationRuleGroups: {
        relatedTypes: [
            "dataElements",
            "sections",
            "dataSets",
            "programStages",
            "programs",
            "indicators",
            "categoryOptions",
            "categoryOptionCombos",
        ],
    },
    visualizations: {
        relatedTypes: [
            "dashboards",
            "maps",
            "legendSets",
            "indicators",
            "dataElements",
        ],
    },
};

const ignoredTopLevelReferenceFields = new Set([
    "sharing",
    "translations",
    "lastUpdatedBy",
    "createdBy",
    "href",
]);

export type JsonPackageEntry = {
    key: string;
    type: string;
    id: string;
    displayName: string;
    raw: JsonRecord;
};

type JsonPackageReference = {
    toKey: string;
    via: string;
};

type JsonPackageIncomingReference = {
    fromKey: string;
    via: string;
};

type TraversalOutgoingRef = {
    ref: JsonPackageReference;
    toEntry: JsonPackageEntry;
};

type TraversalIncomingRef = {
    ref: JsonPackageIncomingReference;
    fromEntry: JsonPackageEntry;
};

export type JsonPackageIndex = {
    types: string[];
    entriesByType: Record<string, JsonPackageEntry[]>;
    entriesByKey: Map<string, JsonPackageEntry>;
    refsByKey: Map<string, JsonPackageReference[]>;
    incomingRefsByKey: Map<string, JsonPackageIncomingReference[]>;
};

export type JsonPackageGraphMode = "expanded" | "direct";

type BuildJsonPackageGraphOptions = {
    maxNodes?: number;
    mode?: JsonPackageGraphMode;
};

export function indexJsonPackage(input: unknown): JsonPackageIndex {
    if (!isRecord(input)) {
        throw new Error("Invalid package format: expected a JSON object");
    }

    const entriesByType: Record<string, JsonPackageEntry[]> = {};
    const entriesByKey = new Map<string, JsonPackageEntry>();
    const idsToKeys = new Map<string, string[]>();

    Object.entries(input).forEach(([type, value]) => {
        if (!Array.isArray(value)) return;

        const entries = value
            .map((item, index) => createPackageEntry(type, item, index))
            .filter((entry): entry is JsonPackageEntry => Boolean(entry));

        if (!entries.length) return;

        entriesByType[type] = entries;

        entries.forEach(entry => {
            entriesByKey.set(entry.key, entry);
            const lookupId = getString(entry.raw.id);
            if (!lookupId) return;
            const keysForId = idsToKeys.get(lookupId) ?? [];
            idsToKeys.set(lookupId, [...keysForId, entry.key]);
        });
    });

    const refsByKey = new Map<string, JsonPackageReference[]>();
    const incomingRefsByKey = new Map<string, JsonPackageIncomingReference[]>();
    entriesByKey.forEach(entry => {
        const references = collectEntryReferences(entry.raw);
        const resolved = resolveReferences(entry.key, references, idsToKeys);
        refsByKey.set(entry.key, resolved);

        resolved.forEach(reference => {
            const incoming = incomingRefsByKey.get(reference.toKey) ?? [];
            incomingRefsByKey.set(reference.toKey, [
                ...incoming,
                { fromKey: entry.key, via: reference.via },
            ]);
        });
    });

    const types = Object.keys(entriesByType).sort(compareTypeNames);
    return { types, entriesByType, entriesByKey, refsByKey, incomingRefsByKey };
}

export function buildJsonPackageDependencyGraph(
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

function createPackageEntry(
    type: string,
    item: unknown,
    index: number
): JsonPackageEntry | null {
    if (!isRecord(item)) return null;

    const id = getString(item.id) || `${type}#${index + 1}`;
    const displayName =
        getString(item.displayName) ||
        getString(item.name) ||
        getString(item.shortName) ||
        id;

    const baseKey = `${type}:${id}`;
    const key = `${baseKey}#${index}`;

    return { key, type, id, displayName, raw: item };
}

function collectEntryReferences(entry: JsonRecord): Array<{ id: string; via: string }> {
    return Object.entries(entry)
        .filter(([field]) => field !== "id" && !ignoredTopLevelReferenceFields.has(field))
        .flatMap(([field, value]) => collectFirstLevelReferences(field, value))
        .filter(reference => Boolean(reference.id));
}

function collectFirstLevelReferences(
    field: string,
    value: unknown
): Array<{ id: string; via: string }> {
    const ids = collectNestedReferenceIds(value);
    return ids.map(id => ({ id, via: field }));
}

function resolveReferences(
    fromKey: string,
    refs: Array<{ id: string; via: string }>,
    idsToKeys: Map<string, string[]>
): JsonPackageReference[] {
    const dedupe = new Map<string, JsonPackageReference>();

    refs.forEach(ref => {
        const toKeys = idsToKeys.get(ref.id) ?? [];
        toKeys.forEach(toKey => {
            if (toKey === fromKey) return;
            const key = `${toKey}|${ref.via}`;
            if (dedupe.has(key)) return;
            dedupe.set(key, { toKey, via: ref.via });
        });
    });

    return Array.from(dedupe.values());
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

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getReferenceId(value: unknown): string | undefined {
    if (!isRecord(value)) return undefined;
    return getString(value.id);
}

function collectNestedReferenceIds(value: unknown): string[] {
    const seen = new Set<string>();
    collectNestedReferenceIdsRec(value, seen);
    return Array.from(seen);
}

function collectNestedReferenceIdsRec(value: unknown, seen: Set<string>) {
    if (Array.isArray(value)) {
        value.forEach(item => collectNestedReferenceIdsRec(item, seen));
        return;
    }

    if (!isRecord(value)) return;

    const id = getReferenceId(value);
    if (id) seen.add(id);

    Object.entries(value).forEach(([key, nested]) => {
        if (key === "id") return;
        collectNestedReferenceIdsRec(nested, seen);
    });
}

function resolveGroupDirection(type: string, centerType?: string): "parent" | "child" {
    if (!centerType) return "child";

    const typePriority = getTypePriority(type);
    const centerPriority = getTypePriority(centerType);
    return typePriority < centerPriority ? "parent" : "child";
}

function compareTypeNames(a: string, b: string): number {
    const diff = getTypePriority(a) - getTypePriority(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
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

function getTypePriority(type: string): number {
    const index = typePriorityOrder.indexOf(type);
    return index === -1 ? typePriorityOrder.length + 1 : index;
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

function getRelatedTypesForCenter(centerType: string): string[] {
    return graphPolicyByCenterType[centerType]?.relatedTypes ?? [];
}

function unique(values: readonly string[]): string[] {
    return Array.from(new Set(values));
}
