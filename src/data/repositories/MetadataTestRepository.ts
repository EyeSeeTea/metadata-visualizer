import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

/**
 * In-memory fake of MetadataRepository for use-case tests.
 *
 * Seed with a Map keyed by ResourceType. The fake applies the minimum matching
 * that is actually exercised by use cases today:
 *  - `type` selects which collection to read from.
 *  - `filters` strings of the form `<path>:eq:<value>` or
 *    `<path>:in:[<v1>,<v2>,...]` are matched. The path may cross nested
 *    objects and arrays: when a segment points at an array, the remainder of
 *    the path is applied to every element and a match on any element is
 *    enough for the filter to succeed. This mirrors DHIS2's own behaviour for
 *    filters like `categoryOptions.id:eq:X`.
 *  - When `paging` is enabled, `page` and `pageSize` slice the results and
 *    populate a minimal pager; otherwise all matching items are returned.
 */
export class MetadataTestRepository implements MetadataRepository {
    constructor(private seed: ReadonlyMap<ResourceType, MetadataItem[]> = new Map()) {}

    public list(query: MetadataQuery): FutureData<MetadataList> {
        const all = this.seed.get(query.type) ?? [];
        const filtered = (query.filters ?? []).reduce<MetadataItem[]>(
            (items, filter) => items.filter(item => matchesFilter(item, filter)),
            all
        );

        const paging = query.paging ?? false;
        if (!paging) {
            return Future.success({ items: filtered });
        }

        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? (filtered.length || 1);
        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);
        const total = filtered.length;
        const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

        return Future.success({
            items: pageItems,
            pager: { page, pageSize, pageCount, total },
        });
    }

    public get(type: ResourceType, id: string, _fields: string): FutureData<MetadataItem> {
        const collection = this.seed.get(type) ?? [];
        const match = collection.find(item => item.id === id);
        return Future.success(match ? { ...match, type } : { type, id, displayName: id });
    }
}

function matchesFilter(item: MetadataItem, filter: string): boolean {
    const inMatch = /^([^:]+):in:\[(.*)\]$/.exec(filter);
    if (inMatch && inMatch[1] !== undefined && inMatch[2] !== undefined) {
        const path = inMatch[1].split(".");
        const expected = new Set(inMatch[2].split(",").filter(value => value.length > 0));
        if (expected.size === 0) return false;
        return collectValues(item, path).some(value => expected.has(String(value)));
    }
    const eqMatch = /^([^:]+):eq:(.+)$/.exec(filter);
    if (eqMatch && eqMatch[1] !== undefined && eqMatch[2] !== undefined) {
        const path = eqMatch[1].split(".");
        const expected = eqMatch[2];
        return collectValues(item, path).some(value => String(value) === expected);
    }
    return true;
}

function collectValues(value: unknown, path: readonly string[]): unknown[] {
    if (path.length === 0) {
        return value === undefined ? [] : [value];
    }
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        return value.flatMap(element => collectValues(element, path));
    }
    if (typeof value !== "object") return [];
    const [head, ...tail] = path;
    if (head === undefined) return [];
    return collectValues((value as Record<string, unknown>)[head], tail);
}
