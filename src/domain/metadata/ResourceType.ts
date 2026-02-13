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

export const selectableResourceTypes = [
    "dataElements",
    "categories",
    "categoryCombos",
    "categoryOptions",
    "categoryOptionCombos",
] as const;
