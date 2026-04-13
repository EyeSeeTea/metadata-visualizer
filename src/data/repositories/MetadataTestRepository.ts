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
 *  - `filters` strings of the form `<field>:eq:<value>` are matched against the
 *    top-level field on each item.
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
    const eqMatch = /^([^:]+):eq:(.+)$/.exec(filter);
    if (!eqMatch || !eqMatch[1] || eqMatch[2] === undefined) return true;
    const [, path, expected] = eqMatch;
    const actual = readPath(item, path.split("."));
    return String(actual) === expected;
}

function readPath(value: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, key) => {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== "object") return undefined;
        return (current as Record<string, unknown>)[key];
    }, value);
}
