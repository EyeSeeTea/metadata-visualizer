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
import { MetadataGraphView3D } from "$/webapp/components/metadata/MetadataGraphView3D";

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
    const [graphState, setGraphState] = React.useState<GraphState>({ type: "idle" });
    const [cocState, setCocState] = React.useState<CocState>({
        type: "idle",
        items: [],
        page: 1,
        pageSize: defaultCocPageSize,
    });
    const [graphView, setGraphView] = React.useState<GraphViewMode>("layout2d");
    const requestId = React.useRef(0);

    React.useEffect(() => {
        if (!selectedItem) {
            setGraphState({ type: "idle" });
            return;
        }

        const currentRequest = ++requestId.current;
        setGraphState({ type: "loading" });

        compositionRoot.metadata.graph
            .execute({ type: selectedItem.type, id: selectedItem.id })
            .toPromise()
            .then(data => {
                if (requestId.current !== currentRequest) return;
                setGraphState({ type: "loaded", data });
            })
            .catch(error => {
                if (requestId.current !== currentRequest) return;
                setGraphState({ type: "error", error });
            });
    }, [compositionRoot, selectedItem]);

    React.useEffect(() => {
        setCocState({ type: "idle", items: [], page: 1, pageSize: defaultCocPageSize });
    }, [selectedItem?.id, selectedItem?.type]);

    const lazyCombo =
        graphState.type === "loaded" ? graphState.data.lazy?.categoryOptionCombos : undefined;

    const handleLoadMore = React.useCallback(() => {
        if (!lazyCombo || cocState.type === "loading") return;
        const basePage = cocState.items.length ? cocState.page : 0;
        const pageToLoad = basePage + 1;

        setCocState(prev => ({ ...prev, type: "loading" }));

        compositionRoot.metadata.listCategoryOptionCombos
            .execute({
                categoryComboId: lazyCombo.categoryComboId,
                page: pageToLoad,
                pageSize: cocState.pageSize,
            })
            .toPromise()
            .then(data => {
                setCocState(prev => ({
                    type: "loaded",
                    items: pageToLoad === 1 ? data.items : [...prev.items, ...data.items],
                    pager: data.pager,
                    page: pageToLoad,
                    pageSize: prev.pageSize,
                }));
            })
            .catch(error => {
                setCocState(prev => ({ ...prev, type: "error", error }));
            });
    }, [
        compositionRoot,
        cocState.items.length,
        cocState.page,
        cocState.pageSize,
        cocState.type,
        lazyCombo,
    ]);

    React.useEffect(() => {
        if (graphState.type !== "loaded") return;
        if (!graphState.data.lazy?.categoryOptionCombos) return;
        if (cocState.type !== "idle") return;
        handleLoadMore();
    }, [graphState, cocState.type, handleLoadMore]);

    if (!selectedItem) {
        return (
            <div className="metadata-graph__placeholder">Select a row to view relationships.</div>
        );
    }

    if (graphState.type === "loading") {
        return <div className="metadata-graph__placeholder">Loading graph...</div>;
    }

    if (graphState.type === "error") {
        return <div className="metadata-graph__placeholder">{graphState.error.message}</div>;
    }

    if (graphState.type !== "loaded") {
        return null;
    }

    const mergedGraph = mergeCategoryOptionCombos(graphState.data, cocState.items);

    const cocPager = cocState.pager;
    const cocTotal = cocPager?.total;
    const cocCanLoadMore = cocPager
        ? cocState.page < cocPager.pageCount
        : cocState.type !== "loaded";

    const lazyButtonLabel =
        cocState.type === "loading"
            ? "Loading..."
            : cocState.type === "idle"
            ? "Load combos"
            : cocCanLoadMore
            ? "Load more"
            : "All loaded";

    const handleOpenApi = (node: GraphNode) => {
        const link = buildApiLink(baseUrl, node.type, node.id);
        window.open(link, "_blank", "noopener,noreferrer");
    };

    const handleFocus = (node: GraphNode) => {
        onFocusItem({ id: node.id, type: node.type, displayName: node.displayName });
    };

    return (
        <div className="metadata-graph__panel">
            <div className="metadata-graph__toolbar">
                <label className="metadata-graph__toolbar-label" htmlFor="metadata-graph-view">
                    Visualizacion
                </label>
                <select
                    id="metadata-graph-view"
                    className="metadata-graph__select"
                    value={graphView}
                    onChange={event => setGraphView(event.target.value as GraphViewMode)}
                >
                    <option value="layout2d">Vista 2D (actual)</option>
                    <option value="force3d">Arbol 3D</option>
                    <option value="timeline3d">Timeline 3D</option>
                </select>
            </div>

            {graphView === "force3d" ? (
                <MetadataGraphView3D
                    graph={mergedGraph}
                    onOpenApi={handleOpenApi}
                    onFocus={handleFocus}
                />
            ) : graphView === "timeline3d" ? (
                <MetadataGraphView3D
                    graph={mergedGraph}
                    layoutMode="timeline"
                    onOpenApi={handleOpenApi}
                    onFocus={handleFocus}
                />
            ) : (
                <MetadataGraphView
                    graph={mergedGraph}
                    onOpenApi={handleOpenApi}
                    onFocus={handleFocus}
                />
            )}

            {lazyCombo && (
                <div className="metadata-graph__lazy">
                    <div className="metadata-graph__lazy-header">
                        Category option combos {cocTotal !== undefined ? `(${cocTotal})` : ""}
                    </div>
                    {cocState.type === "error" && (
                        <div className="metadata-graph__lazy-error">{cocState.error?.message}</div>
                    )}
                    <button
                        type="button"
                        className="metadata-graph__lazy-button"
                        onClick={handleLoadMore}
                        disabled={cocState.type === "loading" || !cocCanLoadMore}
                    >
                        {lazyButtonLabel}
                    </button>
                </div>
            )}
        </div>
    );
};

type GraphState =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; data: MetadataGraph }
    | { type: "error"; error: Error };

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
