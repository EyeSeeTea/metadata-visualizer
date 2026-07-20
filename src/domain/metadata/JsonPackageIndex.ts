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
] as const;

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

export type JsonTypeGraphPolicy = Readonly<{
    relatedTypes: readonly string[];
    noIncomingFromTypes?: readonly string[];
}>;

export const graphPolicyByCenterType: Readonly<Record<string, JsonTypeGraphPolicy>> = {
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
            "categoryOptionGroupSets",
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
        relatedTypes: ["categoryCombos", "categories", "categoryOptions", "dataElements"],
    },
    categoryOptionGroupSets: {
        relatedTypes: ["categoryOptions", "categories", "categoryCombos"],
    },
    categoryOptionGroups: {
        relatedTypes: ["categoryOptions", "categories", "categoryOptionGroupSets"],
    },
    categoryOptions: {
        relatedTypes: [
            "categoryCombos",
            "categories",
            "categoryOptionCombos",
            "categoryOptionGroups",
            "categoryOptionGroupSets",
            "dataElements",
        ],
    },
    dashboards: {
        relatedTypes: ["visualizations", "maps", "indicators", "indicatorGroups"],
        noIncomingFromTypes: ["indicatorTypes"],
    },
    dataElementGroups: {
        relatedTypes: ["dataElements"],
    },
    dataElements: {
        relatedTypes: [
            "dataElementGroups",
            "dataSets",
            "sections",
            "programs",
            "programStages",
            "categoryCombos",
            "categories",
        ],
    },
    dataSets: {
        relatedTypes: [
            "sections",
            "dataElements",
            "dataElementGroups",
            "categoryCombos",
            "categories",
        ],
        noIncomingFromTypes: [
            "categoryCombos",
            "categories",
            "categoryOptions",
            "categoryOptionCombos",
        ],
    },
    indicatorGroups: {
        relatedTypes: ["indicators", "indicatorTypes"],
    },
    indicatorTypes: {
        relatedTypes: ["indicators", "indicatorGroups", "visualizations", "maps", "dashboards"],
    },
    indicators: {
        relatedTypes: [
            "indicatorTypes",
            "indicatorGroups",
            "visualizations",
            "maps",
            "dashboards",
        ],
    },
    legendSets: {
        relatedTypes: ["visualizations", "maps"],
    },
    maps: {
        relatedTypes: ["legendSets", "visualizations", "dashboards"],
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
        relatedTypes: unique([...securityMetadataTypes, "users", "userRoles"]),
    },
    userRoles: {
        relatedTypes: unique([...securityMetadataTypes, "users", "userGroups"]),
    },
    users: {
        relatedTypes: unique([...securityMetadataTypes, "userRoles", "userGroups"]),
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
        relatedTypes: ["dashboards", "maps", "legendSets", "indicators", "dataElements"],
    },
};

const ignoredTopLevelReferenceFields = new Set([
    "sharing",
    "translations",
    "lastUpdatedBy",
    "createdBy",
    "href",
]);

export type JsonPackageEntry = Readonly<{
    key: string;
    type: string;
    id: string;
    displayName: string;
    raw: JsonRecord;
}>;

export type JsonPackageReference = Readonly<{
    toKey: string;
    via: string;
}>;

export type JsonPackageIncomingReference = Readonly<{
    fromKey: string;
    via: string;
}>;

export type JsonPackageIndex = Readonly<{
    types: string[];
    entriesByType: Record<string, JsonPackageEntry[]>;
    entriesByKey: Map<string, JsonPackageEntry>;
    refsByKey: Map<string, JsonPackageReference[]>;
    incomingRefsByKey: Map<string, JsonPackageIncomingReference[]>;
}>;

const jsonPackageGraphModes = ["expanded", "direct"] as const;
export type JsonPackageGraphMode = (typeof jsonPackageGraphModes)[number];

export function isJsonPackageGraphMode(value: string): value is JsonPackageGraphMode {
    return (jsonPackageGraphModes as readonly string[]).includes(value);
}

export function getTypePriority(type: string): number {
    const index = (typePriorityOrder as readonly string[]).indexOf(type);
    return index === -1 ? typePriorityOrder.length + 1 : index;
}

export function compareTypeNames(a: string, b: string): number {
    const diff = getTypePriority(a) - getTypePriority(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
}

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

function unique(values: readonly string[]): string[] {
    return Array.from(new Set(values));
}
