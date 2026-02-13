import React from "react";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { useAppContext } from "$/webapp/contexts/app-context";
import {
    MetadataQueryBuilder,
    MetadataQueryState,
} from "$/webapp/components/metadata/MetadataQueryBuilder";
import { MetadataTable } from "$/webapp/components/metadata/MetadataTable";
import { MetadataGraphPanel } from "$/webapp/components/metadata/MetadataGraphPanel";
import "./MetadataExplorerPage.css";

const defaultFieldsByType: Record<ResourceType, string> = {
    dataElements: "id,displayName,categoryCombo[id,displayName]",
    dataSets: "id,displayName,categoryCombo[id,displayName]",
    categories: "id,displayName,categoryOptions[id,displayName]",
    categoryCombos: "id,displayName,categories[id,displayName]",
    categoryOptions: "id,displayName",
    categoryOptionCombos: "id,displayName,categoryCombo[id,displayName]",
};

const initialQuery: MetadataQueryState = {
    type: "dataElements",
    fields: defaultFieldsByType.dataElements,
    filters: "",
    page: 1,
    pageSize: 20,
    paging: true,
};

export const MetadataExplorerPage: React.FC = () => {
    const { compositionRoot } = useAppContext();
    const [queryState, setQueryState] = React.useState<MetadataQueryState>(initialQuery);
    const [listState, setListState] = React.useState<ListState>({ type: "idle" });
    const [selectedItem, setSelectedItem] = React.useState<MetadataItem | null>(null);
    const requestId = React.useRef(0);

    const runQuery = React.useCallback(
        (activeQuery: MetadataQueryState) => {
            const normalizedFields = normalizeFields(activeQuery.type, activeQuery.fields);
            const filters = parseFilters(activeQuery.filters);

            const query: MetadataQuery = {
                type: activeQuery.type,
                fields: normalizedFields,
                filters,
                page: activeQuery.paging ? activeQuery.page : undefined,
                pageSize: activeQuery.paging ? Math.min(200, activeQuery.pageSize) : undefined,
                paging: activeQuery.paging,
            };

            const currentRequest = ++requestId.current;
            setListState({ type: "loading" });
            setSelectedItem(null);

            compositionRoot.metadata.list
                .execute(query)
                .toPromise()
                .then(data => {
                    if (requestId.current !== currentRequest) return;
                    setListState({ type: "loaded", data });
                })
                .catch(error => {
                    if (requestId.current !== currentRequest) return;
                    setListState({ type: "error", error });
                });
        },
        [compositionRoot]
    );

    React.useEffect(() => {
        runQuery(initialQuery);
    }, [runQuery]);

    const handleTypeChange = (nextType: ResourceType) => {
        const nextQuery: MetadataQueryState = {
            ...queryState,
            type: nextType,
            fields: defaultFieldsByType[nextType],
            filters: "",
            page: 1,
        };
        setQueryState(nextQuery);
        runQuery(nextQuery);
    };

    const handleRun = () => runQuery(queryState);

    const handleSelect = (item: MetadataItem) => {
        setSelectedItem({ ...item, type: queryState.type });
    };

    const handleFocusFromGraph = (item: MetadataItem) => {
        setSelectedItem(item);
    };

    const handlePageChange = (nextPage: number) => {
        if (!queryState.paging) return;
        const nextQuery = { ...queryState, page: nextPage };
        setQueryState(nextQuery);
        runQuery(nextQuery);
    };

    const pager = listState.type === "loaded" ? listState.data.pager : undefined;
    const pageCount = pager?.pageCount ?? 1;
    const total = pager?.total;
    const canPrev = queryState.paging && queryState.page > 1;
    const canNext = queryState.paging && queryState.page < pageCount;

    return (
        <div className="metadata-explorer">
            <MetadataQueryBuilder
                value={queryState}
                onChange={setQueryState}
                onTypeChange={handleTypeChange}
                onRun={handleRun}
            />

            <div className="metadata-summary">
                {listState.type === "loading" && <span>Loading results...</span>}
                {listState.type === "error" && (
                    <span className="metadata-summary__error">{listState.error.message}</span>
                )}
                {listState.type === "loaded" && (
                    <span>
                        {total !== undefined
                            ? `${total} total`
                            : `${listState.data.items.length} items`}
                        {queryState.paging ? ` • page ${queryState.page} of ${pageCount}` : ""}
                    </span>
                )}
            </div>

            <div className="metadata-content">
                <div className="metadata-list">
                    {listState.type === "loaded" && (
                        <MetadataTable
                            items={listState.data.items}
                            type={queryState.type}
                            fields={queryState.fields}
                            selectedId={selectedItem?.id}
                            onSelect={handleSelect}
                        />
                    )}
                    {listState.type === "loading" && (
                        <div className="metadata-table__empty">Fetching metadata...</div>
                    )}

                    <div className="metadata-pager">
                        <button
                            type="button"
                            className="metadata-pager__button"
                            onClick={() => handlePageChange(queryState.page - 1)}
                            disabled={!canPrev || listState.type !== "loaded"}
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            className="metadata-pager__button"
                            onClick={() => handlePageChange(queryState.page + 1)}
                            disabled={!canNext || listState.type !== "loaded"}
                        >
                            Next
                        </button>
                    </div>
                </div>

                <div className="metadata-graph">
                    <MetadataGraphPanel
                        selectedItem={selectedItem}
                        onFocusItem={handleFocusFromGraph}
                    />
                </div>
            </div>
        </div>
    );
};

type ListState =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; data: MetadataList }
    | { type: "error"; error: Error };

function parseFilters(filters: string): string[] | undefined {
    const tokens = filters
        .split(/[\n;]+/)
        .map(token => token.trim())
        .filter(Boolean);

    return tokens.length > 0 ? tokens : undefined;
}

function normalizeFields(type: ResourceType, fields: string): string {
    const base = fields.trim() || defaultFieldsByType[type];
    const withId = ensureField(base, "id");
    return ensureField(withId, "displayName");
}

function ensureField(fields: string, field: string): string {
    const matcher = new RegExp(`(^|,)\\s*${field}\\b`);
    if (matcher.test(fields)) {
        return fields;
    }
    return `${field},${fields}`;
}
