export const resourceTypes = [
    "dataElements",
    "dataSets",
    "categories",
    "categoryCombos",
    "categoryOptions",
    "categoryOptionCombos",
] as const;

export type ResourceType = (typeof resourceTypes)[number];

export function isResourceType(value: string): value is ResourceType {
    return (resourceTypes as readonly string[]).includes(value);
}

export const resourceTypeLabels: Record<ResourceType, string> = {
    dataElements: "Data elements",
    dataSets: "Data sets",
    categories: "Categories",
    categoryCombos: "Category combos",
    categoryOptions: "Category options",
    categoryOptionCombos: "Category option combos",
};

export function getMetadataTypeLabel(type: string): string {
    const normalized = type
        .replace(/[_-\s]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .trim();

    if (!normalized) return type;

    const words = normalized
        .split(/\s+/)
        .map(word => word.toLowerCase())
        .filter(Boolean);

    if (!words.length) return type;

    const [first = "", ...rest] = words;
    return [capitalizeWord(first), ...rest].join(" ");
}

function capitalizeWord(word: string): string {
    if (!word) return word;
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

export const selectableResourceTypes = [
    "dataElements",
    "dataSets",
    "categories",
    "categoryCombos",
    "categoryOptions",
    "categoryOptionCombos",
] as const;
