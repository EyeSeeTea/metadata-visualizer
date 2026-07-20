import { MetadataItem } from "$/domain/metadata/MetadataItem";

/**
 * Runtime validators for DHIS2 payloads.
 *
 * The DHIS2 Web API returns loosely-typed JSON. Before any data-layer repository
 * maps a response into a domain entity it must assert the minimum shape it
 * depends on. These helpers centralise those checks so we never rely on blind
 * `as T` casts at the translation boundary.
 */

export class Dhis2PayloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "Dhis2PayloadError";
    }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringProp<K extends string>(
    value: Record<string, unknown>,
    key: K
): value is Record<string, unknown> & Record<K, string> {
    return typeof value[key] === "string";
}

export type Dhis2ListEnvelope = {
    items: Record<string, unknown>;
};

export function assertListEnvelope(value: unknown, context: string): Dhis2ListEnvelope {
    if (!isRecord(value) || !isRecord(value.items)) {
        throw new Dhis2PayloadError(
            `${context}: expected response envelope with an "items" object, got ${describe(value)}`
        );
    }
    return { items: value.items };
}

export type Dhis2GetEnvelope = {
    item: Record<string, unknown>;
};

export function assertGetEnvelope(value: unknown, context: string): Dhis2GetEnvelope {
    if (!isRecord(value) || !isRecord(value.item)) {
        throw new Dhis2PayloadError(
            `${context}: expected response envelope with an "item" object, got ${describe(value)}`
        );
    }
    return { item: value.item };
}

export function assertMetadataItem(value: unknown, context: string): MetadataItem {
    if (!isRecord(value) || !hasStringProp(value, "id")) {
        throw new Dhis2PayloadError(
            `${context}: expected metadata item with string "id", got ${describe(value)}`
        );
    }
    // The caller is responsible for stamping `type` on the returned item.
    return value as unknown as MetadataItem;
}

export function assertMetadataItems(value: unknown, context: string): MetadataItem[] {
    if (!Array.isArray(value)) {
        throw new Dhis2PayloadError(
            `${context}: expected array of metadata items, got ${describe(value)}`
        );
    }
    return value.map((item, index) => assertMetadataItem(item, `${context}[${index}]`));
}

export type Dhis2Pager = {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
};

export function parsePager(value: unknown): Dhis2Pager | undefined {
    if (!isRecord(value)) return undefined;
    const { page, pageSize, pageCount, total } = value;
    if (
        typeof page !== "number" ||
        typeof pageSize !== "number" ||
        typeof pageCount !== "number" ||
        typeof total !== "number"
    ) {
        return undefined;
    }
    return { page, pageSize, pageCount, total };
}

function describe(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}
