import { MetadataGraph } from "$/domain/metadata/MetadataGraph";
import { ResourceType } from "$/domain/metadata/ResourceType";

type JsonRecord = Record<string, unknown>;

const typePriorityOrder = [
    "categoryOptionCombos",
    "categoryOptions",
    "categoryCombos",
    "categories",
    "dataElements",
    "indicators",
    "dataSets",
    "programs",
    "sections",
    "visualizations",
    "dashboards",
    "maps",
    "legendSets",
] as const;

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

export type JsonPackageIndex = {
    types: string[];
    entriesByType: Record<string, JsonPackageEntry[]>;
    entriesByKey: Map<string, JsonPackageEntry>;
    refsByKey: Map<string, JsonPackageReference[]>;
    incomingRefsByKey: Map<string, JsonPackageIncomingReference[]>;
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
    maxNodes = 250
): MetadataGraph {
    const centerEntry = index.entriesByKey.get(centerKey);
    if (!centerEntry) {
        throw new Error(`Metadata item not found: ${centerKey}`);
    }

    const visitedKeys = new Set<string>([centerKey]);
    const queue = [centerKey];
    const graphEdges = new Map<string, { from: string; to: string; label: string }>();

    while (queue.length > 0) {
        const fromKey = queue.shift();
        if (!fromKey) continue;

        const refs = index.refsByKey.get(fromKey) ?? [];
        refs.forEach(ref => {
            const edgeKey = `${fromKey}|${ref.toKey}|${ref.via}`;
            if (!graphEdges.has(edgeKey)) {
                graphEdges.set(edgeKey, { from: fromKey, to: ref.toKey, label: ref.via });
            }

            if (visitedKeys.size >= maxNodes) return;
            if (visitedKeys.has(ref.toKey)) return;
            if (!index.entriesByKey.has(ref.toKey)) return;

            visitedKeys.add(ref.toKey);
            queue.push(ref.toKey);
        });

        const incomingRefs = index.incomingRefsByKey.get(fromKey) ?? [];
        incomingRefs.forEach(ref => {
            const edgeKey = `${ref.fromKey}|${fromKey}|${ref.via}`;
            if (!graphEdges.has(edgeKey)) {
                graphEdges.set(edgeKey, { from: ref.fromKey, to: fromKey, label: ref.via });
            }

            if (visitedKeys.size >= maxNodes) return;
            if (visitedKeys.has(ref.fromKey)) return;
            if (!index.entriesByKey.has(ref.fromKey)) return;

            visitedKeys.add(ref.fromKey);
            queue.push(ref.fromKey);
        });
    }

    const nodes = Array.from(visitedKeys)
        .map(key => index.entriesByKey.get(key))
        .filter((entry): entry is JsonPackageEntry => Boolean(entry))
        .map(entry => ({
            key: entry.key,
            id: entry.id,
            type: entry.type as ResourceType,
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

        const nodes = groupsByType.get(entry.type) ?? [];
        groupsByType.set(entry.type, [...nodes, nodeKey]);
    });

    return Array.from(groupsByType.entries())
        .sort(([a], [b]) => compareTypeNames(a, b))
        .map(([type, nodeKeys]) => ({
            id: `json-type:${type}`,
            title: type,
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

function getTypePriority(type: string): number {
    const index = typePriorityOrder.indexOf(type as (typeof typePriorityOrder)[number]);
    return index === -1 ? typePriorityOrder.length + 1 : index;
}
