import React from "react";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataQuery } from "$/domain/metadata/MetadataQuery";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { ensureFields } from "$/domain/metadata/fields";
import { MAX_PAGE_SIZE } from "$/domain/metadata/pagination";
import i18n from "$/utils/i18n";
import { useAppContext } from "$/webapp/contexts/app-context";
import {
    MetadataQueryBuilder,
    MetadataQueryState,
} from "$/webapp/components/metadata/MetadataQueryBuilder";
import { MetadataTable } from "$/webapp/components/metadata/MetadataTable";
import { MetadataGraphPanel } from "$/webapp/components/metadata/MetadataGraphPanel";
import { useFuture } from "$/webapp/hooks/useFuture";
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
    const [activeQuery, setActiveQuery] = React.useState<MetadataQuery>(() =>
        buildQuery(initialQuery)
    );
    const [selectedItem, setSelectedItem] = React.useState<MetadataItem | null>(null);

    const listState = useFuture<MetadataList>(
        () => compositionRoot.metadata.list.execute(activeQuery),
        [compositionRoot, activeQuery]
    );

    React.useEffect(() => {
        // Clear the selected item whenever a new request is issued.
        setSelectedItem(null);
    }, [activeQuery]);

    const runQuery = React.useCallback((next: MetadataQueryState) => {
        setActiveQuery(buildQuery(next));
    }, []);

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
                {listState.type === "loading" && <span>{i18n.t("Loading results...")}</span>}
                {listState.type === "error" && (
                    <span className="metadata-summary__error">{listState.error.message}</span>
                )}
                {listState.type === "loaded" && (
                    <span>
                        {total !== undefined
                            ? i18n.t("{{total}} total", { total })
                            : i18n.t("{{itemCount}} items", {
                                  itemCount: listState.data.items.length,
                              })}
                        {queryState.paging
                            ? ` • ${i18n.t("page {{page}} of {{pageCount}}", {
                                  page: queryState.page,
                                  pageCount,
                              })}`
                            : ""}
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
                        <div className="metadata-table__empty">
                            {i18n.t("Fetching metadata...")}
                        </div>
                    )}

                    <div className="metadata-pager">
                        <button
                            type="button"
                            className="metadata-pager__button"
                            onClick={() => handlePageChange(queryState.page - 1)}
                            disabled={!canPrev || listState.type !== "loaded"}
                        >
                            {i18n.t("Prev")}
                        </button>
                        <button
                            type="button"
                            className="metadata-pager__button"
                            onClick={() => handlePageChange(queryState.page + 1)}
                            disabled={!canNext || listState.type !== "loaded"}
                        >
                            {i18n.t("Next")}
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

function buildQuery(state: MetadataQueryState): MetadataQuery {
    const normalizedFields = normalizeFields(state.type, state.fields);
    const filters = parseFilters(state.filters);

    return {
        type: state.type,
        fields: normalizedFields,
        filters,
        page: state.paging ? state.page : undefined,
        pageSize: state.paging ? Math.min(MAX_PAGE_SIZE, state.pageSize) : undefined,
        paging: state.paging,
    };
}

function parseFilters(filters: string): string[] | undefined {
    const tokens = filters
        .split(/[\n;]+/)
        .map(token => token.trim())
        .filter(Boolean);

    return tokens.length > 0 ? tokens : undefined;
}

function normalizeFields(type: ResourceType, fields: string): string {
    const base = fields.trim() || defaultFieldsByType[type];
    return ensureFields(base, ["id", "displayName"]);
}
