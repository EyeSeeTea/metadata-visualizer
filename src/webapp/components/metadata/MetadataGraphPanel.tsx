import React from "react";
import { useConfig } from "@dhis2/app-runtime";
import {
    GraphEdge,
    GraphGroup,
    GraphNode,
    MetadataGraph,
    graphNodeKey,
} from "$/domain/metadata/MetadataGraph";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { useAppContext } from "$/webapp/contexts/app-context";
import { MetadataGraphView } from "$/webapp/components/metadata/MetadataGraphView";
import { ErrorBoundary } from "$/webapp/components/error-boundary/ErrorBoundary";
import { useFuture } from "$/webapp/hooks/useFuture";
import i18n from "$/utils/i18n";

// Lazy-load the 3D view so that the top-level `import * as THREE from "three"` is only
// executed once the user selects the 3D option. On browsers without WebGL/WebGPU the
// three.js module evaluation throws (e.g. "GPUShaderStage is undefined"); isolating
// that failure behind a dynamic import + error boundary keeps the rest of the app usable.
const MetadataGraphView3D = React.lazy(
    () => import("$/webapp/components/metadata/MetadataGraphView3D")
);

type MetadataGraphPanelProps = {
    selectedItem: MetadataItem | null;
    onFocusItem: (item: MetadataItem) => void;
};

const defaultCocPageSize = 20;

export const MetadataGraphPanel: React.FC<MetadataGraphPanelProps> = ({
    selectedItem,
    onFocusItem,
}) => {
    const { baseUrl } = useConfig();
    const { compositionRoot } = useAppContext();
    const [cocState, setCocState] = React.useState<CocState>({
        type: "idle",
        items: [],
        page: 1,
        pageSize: defaultCocPageSize,
    });
    const [graphView, setGraphView] = React.useState<GraphViewMode>("layout2d");
    const cocCancelRef = React.useRef<(() => void) | null>(null);
    const autoLoadKeyRef = React.useRef<string | null>(null);

    const graphState = useFuture<MetadataGraph>(
        () =>
            selectedItem
                ? compositionRoot.metadata.graph.execute({
                      type: selectedItem.type,
                      id: selectedItem.id,
                  })
                : null,
        [compositionRoot, selectedItem?.id, selectedItem?.type]
    );

    // Reset combo state and cancel any in-flight combo request when the selection changes
    // or when the panel unmounts. Keeping this isolated from the auto-load effect avoids
    // the race where putting `cocState.type` in an effect's deps would cancel the request
    // it just kicked off.
    React.useEffect(() => {
        autoLoadKeyRef.current = null;
        setCocState({ type: "idle", items: [], page: 1, pageSize: defaultCocPageSize });
        return () => {
            cocCancelRef.current?.();
            cocCancelRef.current = null;
        };
    }, [selectedItem?.id, selectedItem?.type]);

    const lazyCombo =
        graphState.type === "loaded" ? graphState.data.lazy?.categoryOptionCombos : undefined;

    const loadCombosPage = React.useCallback(
        (pageToLoad: number): void => {
            if (!lazyCombo) return;

            // Cancel any prior in-flight combo request before starting a new one.
            cocCancelRef.current?.();

            setCocState(prev => ({ ...prev, type: "loading" }));

            cocCancelRef.current =
                compositionRoot.metadata.listCategoryOptionCombos
                    .execute({
                        categoryComboId: lazyCombo.categoryComboId,
                        page: pageToLoad,
                        pageSize: cocState.pageSize,
                    })
                    .run(
                        data => {
                            cocCancelRef.current = null;
                            setCocState(prev => ({
                                type: "loaded",
                                items:
                                    pageToLoad === 1 ? data.items : [...prev.items, ...data.items],
                                pager: data.pager,
                                page: pageToLoad,
                                pageSize: prev.pageSize,
                            }));
                        },
                        error => {
                            cocCancelRef.current = null;
                            setCocState(prev => ({ ...prev, type: "error", error }));
                        }
                    ) ?? null;
        },
        [compositionRoot, cocState.pageSize, lazyCombo]
    );

    const handleLoadMore = React.useCallback((): void => {
        if (!lazyCombo || cocState.type === "loading") return;
        const basePage = cocState.items.length ? cocState.page : 0;
        loadCombosPage(basePage + 1);
    }, [cocState.items.length, cocState.page, cocState.type, lazyCombo, loadCombosPage]);

    // Auto-load page 1 when the graph is ready. The ref-based guard makes this fire exactly
    // once per (selectedItem, categoryCombo) pair. We intentionally do NOT return a cleanup
    // here: cancellation is handled by the selectedItem-change effect above and by
    // loadCombosPage cancelling its own predecessor.
    React.useEffect(() => {
        if (graphState.type !== "loaded") return;
        const lazy = graphState.data.lazy?.categoryOptionCombos;
        if (!lazy) return;
        const key = `${selectedItem?.type ?? ""}:${selectedItem?.id ?? ""}:${lazy.categoryComboId}`;
        if (autoLoadKeyRef.current === key) return;
        autoLoadKeyRef.current = key;
        loadCombosPage(1);
    }, [graphState, selectedItem?.id, selectedItem?.type, loadCombosPage]);

    const mergedGraph = React.useMemo(() => {
        if (graphState.type !== "loaded") return null;
        return mergeCategoryOptionCombos(graphState.data, cocState.items);
    }, [graphState, cocState.items]);

    if (!selectedItem) {
        return (
            <div className="metadata-graph__placeholder">
                {i18n.t("Select a row to view relationships.")}
            </div>
        );
    }

    if (graphState.type === "loading") {
        return <div className="metadata-graph__placeholder">{i18n.t("Loading graph...")}</div>;
    }

    if (graphState.type === "error") {
        return <div className="metadata-graph__placeholder">{graphState.error.message}</div>;
    }

    if (graphState.type !== "loaded" || !mergedGraph) {
        return null;
    }

    const cocPager = cocState.pager;
    const cocCanLoadMore = cocPager ? cocState.page < cocPager.pageCount : false;
    // Only surface the lazy combos UI when there is something actionable: a load failure
    // (so the user can retry) or more pages available beyond the auto-loaded first page.
    // The happy path stays clutter-free — the combos are merged into the graph silently.
    const showLazyCombos = Boolean(lazyCombo) && (cocState.type === "error" || cocCanLoadMore);

    const handleOpenApi = (node: GraphNode) => {
        const link = buildApiLink(baseUrl, node.type, node.id);
        window.open(link, "_blank", "noopener,noreferrer");
    };

    const handleFocus = (node: GraphNode) => {
        onFocusItem({ id: node.id, type: node.type, displayName: node.displayName });
    };

    const render2D = () => (
        <MetadataGraphView graph={mergedGraph} onOpenApi={handleOpenApi} onFocus={handleFocus} />
    );

    const render3D = (layoutMode: "radial" | "timeline") => (
        <ErrorBoundary
            fallback={() => (
                <div className="metadata-graph__fallback">
                    <div className="metadata-graph__alert" role="alert">
                        {i18n.t(
                            "3D view unavailable in this browser. Falling back to 2D. Enable WebGL/WebGPU to use the 3D view."
                        )}
                    </div>
                    {render2D()}
                </div>
            )}
        >
            <React.Suspense
                fallback={
                    <div className="metadata-graph__placeholder">
                        {i18n.t("Loading 3D view...")}
                    </div>
                }
            >
                <MetadataGraphView3D
                    graph={mergedGraph}
                    layoutMode={layoutMode}
                    onOpenApi={handleOpenApi}
                    onFocus={handleFocus}
                />
            </React.Suspense>
        </ErrorBoundary>
    );

    return (
        <div className="metadata-graph__panel">
            <div className="metadata-graph__toolbar">
                <label className="metadata-graph__toolbar-label" htmlFor="metadata-graph-view">
                    {i18n.t("Visualization")}
                </label>
                <select
                    id="metadata-graph-view"
                    className="metadata-graph__select"
                    value={graphView}
                    onChange={event => setGraphView(event.target.value as GraphViewMode)}
                >
                    <option value="layout2d">{i18n.t("2D View")}</option>
                    <option value="force3d">{i18n.t("3D Tree")}</option>
                    <option value="timeline3d">{i18n.t("3D Timeline")}</option>
                </select>
            </div>

            {graphView === "force3d"
                ? render3D("radial")
                : graphView === "timeline3d"
                ? render3D("timeline")
                : render2D()}

            {showLazyCombos && (
                <div className="metadata-graph__lazy">
                    {cocState.type === "error" && (
                        <div className="metadata-graph__lazy-error" role="alert">
                            {i18n.t("Failed to load category option combos:")}{" "}
                            {cocState.error.message}
                        </div>
                    )}
                    <button
                        type="button"
                        className="metadata-graph__lazy-button"
                        onClick={handleLoadMore}
                        disabled={cocState.type === "loading"}
                    >
                        {cocState.type === "loading"
                            ? i18n.t("Loading...")
                            : cocState.type === "error"
                            ? i18n.t("Retry")
                            : i18n.t("Load more category option combos")}
                    </button>
                </div>
            )}
        </div>
    );
};

type CocState =
    | {
          type: "idle" | "loading";
          items: MetadataItem[];
          page: number;
          pageSize: number;
          error?: Error;
          pager?: MetadataList["pager"];
      }
    | {
          type: "loaded";
          items: MetadataItem[];
          page: number;
          pageSize: number;
          pager?: MetadataList["pager"];
      }
    | {
          type: "error";
          items: MetadataItem[];
          page: number;
          pageSize: number;
          error: Error;
          pager?: MetadataList["pager"];
      };

type GraphViewMode = "layout2d" | "force3d" | "timeline3d";

function mergeCategoryOptionCombos(graph: MetadataGraph, combos: MetadataItem[]): MetadataGraph {
    if (!combos.length || !graph.lazy?.categoryOptionCombos) {
        return graph;
    }

    const comboId = graph.lazy.categoryOptionCombos.categoryComboId;
    const comboKey = graphNodeKey("categoryCombos", comboId);

    const newNodes: GraphNode[] = combos.map(item => ({
        key: graphNodeKey("categoryOptionCombos", item.id),
        type: "categoryOptionCombos",
        id: item.id,
        displayName: item.displayName ?? item.name ?? item.id,
    }));

    const newEdges: GraphEdge[] = newNodes.map(node => ({
        from: comboKey,
        to: node.key,
        label: "categoryOptionCombos",
    }));

    const nodesByKey = new Map<string, GraphNode>(graph.nodes.map(node => [node.key, node]));
    newNodes.forEach(node => nodesByKey.set(node.key, node));

    const groupId = "category-option-combos";
    const filteredGroups = graph.groups.filter(group => group.id !== groupId);
    const group: GraphGroup = {
        id: groupId,
        title: "Category option combos",
        nodeKeys: newNodes.map(node => node.key),
        direction: "child",
    };

    return {
        ...graph,
        nodes: Array.from(nodesByKey.values()),
        edges: [...graph.edges, ...newEdges],
        groups: [...filteredGroups, group],
    };
}

function buildApiLink(baseUrl: string, type: string, id: string): string {
    const trimmed = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmed}/api/${type}/${id}.json?fields=id,displayName`;
}
