import React from "react";
import { GraphGroup, GraphNode, MetadataGraph } from "$/domain/metadata/MetadataGraph";
import { isResourceType, resourceTypeLabels } from "$/domain/metadata/ResourceType";
import { IdenticonAvatar } from "$/webapp/components/metadata/IdenticonAvatar";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import CenterFocusStrongIcon from "@material-ui/icons/CenterFocusStrong";
import i18n from "$/utils/i18n";

type MetadataGraphViewProps = {
    graph: MetadataGraph;
    onOpenApi?: (node: GraphNode) => void;
    onFocus?: (node: GraphNode) => void;
};

type Line = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
};

export const MetadataGraphView: React.FC<MetadataGraphViewProps> = ({
    graph,
    onOpenApi,
    onFocus,
}) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const dragRef = React.useRef<DragState>(null);
    const didDragRef = React.useRef(false);
    const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const [lines, setLines] = React.useState<Line[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [canvasSize, setCanvasSize] = React.useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    const nodeMap = React.useMemo(() => {
        return new Map(graph.nodes.map(node => [node.key, node]));
    }, [graph.nodes]);

    const orderedGroups = React.useMemo(() => {
        const parentGroups = graph.groups.filter(group => group.direction === "parent");
        const childGroups = graph.groups.filter(group => group.direction === "child");
        if (parentGroups.length > 0 && childGroups.length > 0) {
            return [...parentGroups, ...childGroups];
        }
        return graph.groups;
    }, [graph.groups]);

    const registerNode = React.useCallback((key: string) => {
        return (element: HTMLDivElement | null) => {
            nodeRefs.current[key] = element;
        };
    }, []);

    React.useLayoutEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            setCanvasSize({
                width: containerRef.current.scrollWidth,
                height: containerRef.current.scrollHeight,
            });

            const nextLines = graph.edges
                .map(edge => {
                    const fromEl = nodeRefs.current[edge.from];
                    const toEl = nodeRefs.current[edge.to];
                    if (!fromEl || !toEl) return null;
                    const fromRect = fromEl.getBoundingClientRect();
                    const toRect = toEl.getBoundingClientRect();

                    return {
                        x1: fromRect.left + fromRect.width / 2 - containerRect.left,
                        y1: fromRect.top + fromRect.height / 2 - containerRect.top,
                        x2: toRect.left + toRect.width / 2 - containerRect.left,
                        y2: toRect.top + toRect.height / 2 - containerRect.top,
                        label: edge.label,
                    };
                })
                .filter((line): line is Line => Boolean(line));

            setLines(nextLines);
        };

        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [graph.edges, graph.nodes, graph.groups]);

    const centerNode = nodeMap.get(graph.center);
    const centerTypeLabel = centerNode
        ? isResourceType(centerNode.type)
            ? resourceTypeLabels[centerNode.type]
            : centerNode.type
        : "";

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest(".graph-node")) return;

        didDragRef.current = false;
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: event.currentTarget.scrollLeft,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }, []);

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        if (Math.abs(deltaX) > 2) {
            didDragRef.current = true;
            setIsDragging(true);
            event.preventDefault();
        }

        event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX;
    }, []);

    const handlePointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.currentTarget.releasePointerCapture(event.pointerId);
        dragRef.current = null;
        setIsDragging(false);
    }, []);

    const handleClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!didDragRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        didDragRef.current = false;
    }, []);

    return (
        <div
            className={isDragging ? "graph-layout graph-layout--dragging" : "graph-layout"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onClickCapture={handleClickCapture}
        >
            <div className="graph-layout__canvas" ref={containerRef}>
                <svg
                    className="graph-layout__edges"
                    style={{ width: canvasSize.width, height: canvasSize.height }}
                >
                    {lines.map((line, index) => (
                        <line
                            key={`${line.label}-${index}`}
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="#9aa8bf"
                            strokeWidth={1}
                        />
                    ))}
                </svg>

                <div className="graph-layout__columns">
                    <div className="graph-layout__column graph-layout__column--center">
                        {centerNode && (
                            <>
                                <div className="graph-layout__group-title">
                                    {centerTypeLabel} (1)
                                </div>
                                <GraphNodeCard
                                    node={centerNode}
                                    registerNode={registerNode}
                                    isCenter
                                    onOpenApi={onOpenApi}
                                    onFocus={onFocus}
                                />
                            </>
                        )}
                    </div>

                    {orderedGroups.map(group => (
                        <GraphGroupColumn
                            key={group.id}
                            group={group}
                            nodeMap={nodeMap}
                            registerNode={registerNode}
                            onOpenApi={onOpenApi}
                            onFocus={onFocus}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

type DragState = {
    pointerId: number;
    startX: number;
    startScrollLeft: number;
} | null;

const GraphGroupColumn: React.FC<{
    group: GraphGroup;
    nodeMap: Map<string, GraphNode>;
    registerNode: (key: string) => (element: HTMLDivElement | null) => void;
    onOpenApi?: (node: GraphNode) => void;
    onFocus?: (node: GraphNode) => void;
}> = ({ group, nodeMap, registerNode, onOpenApi, onFocus }) => {
    if (!group.nodeKeys.length) {
        return null;
    }

    return (
        <div className="graph-layout__column">
            <div className="graph-layout__group">
                <div className="graph-layout__group-title">
                    {group.title} ({group.nodeKeys.length})
                </div>
                <div className="graph-layout__group-nodes">
                    {group.nodeKeys.map(key => {
                        const node = nodeMap.get(key);
                        if (!node) return null;
                        return (
                            <GraphNodeCard
                                key={key}
                                node={node}
                                registerNode={registerNode}
                                onOpenApi={onOpenApi}
                                onFocus={onFocus}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const GraphNodeCard: React.FC<{
    node: GraphNode;
    registerNode: (key: string) => (element: HTMLDivElement | null) => void;
    isCenter?: boolean;
    onOpenApi?: (node: GraphNode) => void;
    onFocus?: (node: GraphNode) => void;
}> = ({ node, registerNode, isCenter = false, onOpenApi, onFocus }) => {
    return (
        <div
            ref={registerNode(node.key)}
            className={isCenter ? "graph-node graph-node--center" : "graph-node"}
        >
            <IdenticonAvatar
                type={node.type}
                uid={node.id}
                size={28}
                className="graph-node__avatar"
            />
            <div className="graph-node__label">
                <div className="graph-node__title">{node.displayName}</div>
                <div className="graph-node__subtitle">
                    <span className="graph-node__uid" title={node.id}>
                        {node.id}
                    </span>
                    <span className="graph-node__actions">
                        {onOpenApi && (
                            <button
                                type="button"
                                className="graph-node__action"
                                title={i18n.t("Open API")}
                                onClick={() => onOpenApi(node)}
                            >
                                <OpenInNewIcon fontSize="small" />
                            </button>
                        )}
                        {onFocus && (
                            <button
                                type="button"
                                className="graph-node__action"
                                title={i18n.t("Focus in graph")}
                                onClick={() => onFocus(node)}
                            >
                                <CenterFocusStrongIcon fontSize="small" />
                            </button>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
};
