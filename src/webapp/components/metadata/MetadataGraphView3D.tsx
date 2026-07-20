// Polyfill must be imported before three / react-force-graph-3d so that
// `self.GPUShaderStage` is truthy when the upstream module-level polyfill runs.
// See `./webgpu-polyfill.ts` for the full explanation.
import "$/webapp/components/metadata/webgpu-polyfill";
import React from "react";
import ForceGraph3D, {
    ForceGraphMethods,
    GraphData,
    LinkObject,
    NodeObject,
} from "react-force-graph-3d";
import * as THREE from "three";
import { GraphEdge, GraphNode, MetadataGraph } from "$/domain/metadata/MetadataGraph";
import { buildIdenticonSvg, identiconSeed, sha256Hex } from "$/domain/metadata/Identicon";
import { getMetadataTypeLabel } from "$/domain/metadata/ResourceType";
import i18n from "$/utils/i18n";

type ForceNode = NodeObject & {
    id: string;
    name: string;
    type: GraphNode["type"];
    raw: GraphNode;
    val: number;
    fx?: number;
    fy?: number;
    fz?: number;
};

type ForceLink = LinkObject<ForceNode> & {
    source: string;
    target: string;
    label: string;
};

type MetadataGraphView3DProps = {
    graph: MetadataGraph;
    onOpenApi?: (node: GraphNode) => void;
    onFocus?: (node: GraphNode) => void;
    layoutMode?: "radial" | "timeline";
};

type ThreeCaches = {
    textureLoader: THREE.TextureLoader;
    textureByKey: Map<string, THREE.Texture>;
    texturePromises: Map<string, Promise<THREE.Texture>>;
    geometryBySize: Map<number, THREE.BoxGeometry>;
    materials: Set<THREE.Material>;
};

function createCaches(): ThreeCaches {
    return {
        textureLoader: new THREE.TextureLoader(),
        textureByKey: new Map(),
        texturePromises: new Map(),
        geometryBySize: new Map(),
        materials: new Set(),
    };
}

const MetadataGraphView3D: React.FC<MetadataGraphView3DProps> = ({
    graph,
    onOpenApi,
    onFocus,
    layoutMode = "radial",
}) => {
    const graphRef = React.useRef<ForceGraphMethods<ForceNode, ForceLink>>();
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const cachesRef = React.useRef<ThreeCaches | null>(null);
    if (cachesRef.current === null) {
        cachesRef.current = createCaches();
    }
    const [size, setSize] = React.useState({ width: 0, height: 420 });
    const [useTexture, setUseTexture] = React.useState(true);

    const nodeThreeObject = React.useCallback((node: ForceNode) => {
        const caches = cachesRef.current;
        if (!caches) throw new Error("Three.js caches not initialized");
        const cubeSize = Math.max(6, node.val * 1.2);
        const geometry = getCubeGeometry(caches, cubeSize);
        const material = new THREE.MeshLambertMaterial({ color: "#64748b" });
        caches.materials.add(material);
        const mesh = new THREE.Mesh(geometry, material);

        getNodeTexture(caches, node)
            .then(texture => {
                material.map = texture;
                material.needsUpdate = true;
            })
            .catch(() => {
                // Keep fallback color if texture fails.
            });

        return mesh;
    }, []);

    const forceData = React.useMemo(() => {
        const layout = layoutMode === "timeline" ? buildTimelineLayout(graph) : undefined;
        return toForceGraphData(graph, layout);
    }, [graph, layoutMode]);

    React.useLayoutEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            setSize({
                width: clientWidth,
                height: clientHeight || 420,
            });
        };

        measure();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;

        if (observer && containerRef.current) {
            observer.observe(containerRef.current);
        }

        if (!observer) {
            window.addEventListener("resize", measure);
        }

        return () => {
            observer?.disconnect();
            if (!observer) {
                window.removeEventListener("resize", measure);
            }
        };
    }, []);

    React.useEffect(() => {
        if (!graphRef.current) return;
        graphRef.current.zoomToFit(600, 60);
        graphRef.current.cameraPosition({ x: 0, y: 0, z: 320 }, { x: 0, y: 0, z: 0 }, 800);
    }, [forceData, size]);

    // Dispose all GPU resources on unmount.
    React.useEffect(() => {
        return () => {
            const caches = cachesRef.current;
            if (!caches) return;
            caches.textureByKey.forEach(texture => texture.dispose());
            caches.textureByKey.clear();
            caches.texturePromises.clear();
            caches.geometryBySize.forEach(geometry => geometry.dispose());
            caches.geometryBySize.clear();
            caches.materials.forEach(material => material.dispose());
            caches.materials.clear();
            cachesRef.current = null;
        };
    }, []);

    const handleFocus = React.useCallback(
        (node: ForceNode) => {
            onFocus?.(node.raw);
        },
        [onFocus]
    );

    const handleOpenApi = React.useCallback(
        (node: ForceNode) => {
            onOpenApi?.(node.raw);
        },
        [onOpenApi]
    );

    return (
        <div className="metadata-graph__view3d" ref={containerRef}>
            <ForceGraph3D
                key={`${layoutMode}-${useTexture ? "texture" : "color"}`}
                ref={graphRef}
                graphData={forceData}
                width={size.width}
                height={size.height}
                nodeId="id"
                linkSource="source"
                linkTarget="target"
                nodeLabel={node =>
                    `${getMetadataTypeLabel(node.type)}: ${node.name}`
                }
                linkLabel={link => link.label}
                nodeAutoColorBy={useTexture ? undefined : "type"}
                backgroundColor="#0f172a"
                showNavInfo={false}
                dagMode={layoutMode === "radial" ? "radialout" : undefined}
                dagLevelDistance={80}
                cooldownTicks={layoutMode === "timeline" ? 0 : undefined}
                cooldownTime={layoutMode === "timeline" ? 0 : undefined}
                linkDirectionalArrowLength={4}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.006}
                enableNodeDrag={false}
                nodeThreeObject={
                    useTexture ? (node: ForceNode) => nodeThreeObject(node) : undefined
                }
                onNodeClick={node => handleFocus(node as ForceNode)}
                onNodeRightClick={node => handleOpenApi(node as ForceNode)}
            />

            <div className="metadata-graph__controls">
                <button
                    type="button"
                    className="metadata-graph__control-button"
                    onClick={() => setUseTexture(value => !value)}
                >
                    {useTexture ? i18n.t("Colors") : i18n.t("Textures")}
                </button>
            </div>

            <div className="metadata-graph__hint">
                {i18n.t("Click to focus - Right click opens the API")}
            </div>
        </div>
    );
};

// Default export enables React.lazy(() => import("./MetadataGraphView3D")).
// This prevents top-level `import * as THREE from "three"` from executing until the
// user actually opens the 3D view, so browsers without WebGL/WebGPU keep working.
export default MetadataGraphView3D;

function toForceGraphData(
    graph: MetadataGraph,
    layout?: Map<string, { x: number; y: number; z: number }>
): GraphData<ForceNode, ForceLink> {
    const nodes: ForceNode[] = graph.nodes.map(node => {
        const position = layout?.get(node.key);
        return {
            id: node.key,
            name: node.displayName,
            type: node.type,
            raw: node,
            val: node.key === graph.center ? 12 : 6,
            ...(position ? { fx: position.x, fy: position.y, fz: position.z } : {}),
        };
    });

    const links: ForceLink[] = graph.edges.map(edge => {
        const oriented = orientEdge(edge, graph.center);
        return { source: oriented.source, target: oriented.target, label: edge.label };
    });

    return { nodes, links };
}

function buildTimelineLayout(
    graph: MetadataGraph
): Map<string, { x: number; y: number; z: number }> {
    const layout = new Map<string, { x: number; y: number; z: number }>();
    const nodeByKey = new Map(graph.nodes.map(node => [node.key, node]));

    const parentGroups = graph.groups.filter(group => group.direction === "parent");
    const childGroups = graph.groups.filter(group => group.direction === "child");

    const sectionSpacing = 180;
    const bandSpacing = 140;
    const nodeSpacing = 48;

    const placeBand = (group: (typeof graph.groups)[number], x: number, z: number) => {
        const nodes = group.nodeKeys
            .map(key => nodeByKey.get(key))
            .filter((node): node is GraphNode => Boolean(node));
        const sorted = nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
        const startY = -((sorted.length - 1) / 2) * nodeSpacing;
        sorted.forEach((node, index) => {
            if (layout.has(node.key)) return;
            layout.set(node.key, {
                x,
                y: startY + index * nodeSpacing,
                z,
            });
        });
    };

    parentGroups.forEach((group, index) => {
        const x = -sectionSpacing * (index + 1);
        const z = (index - (parentGroups.length - 1) / 2) * bandSpacing;
        placeBand(group, x, z);
    });

    childGroups.forEach((group, index) => {
        const x = sectionSpacing * (index + 1);
        const z = (index - (childGroups.length - 1) / 2) * bandSpacing;
        placeBand(group, x, z);
    });

    const ungrouped = graph.nodes.filter(node => !layout.has(node.key));
    if (ungrouped.length) {
        const x = sectionSpacing * (childGroups.length + 1);
        const startY = -((ungrouped.length - 1) / 2) * nodeSpacing;
        const sorted = ungrouped.sort((a, b) => {
            if (a.type === b.type) {
                return a.displayName.localeCompare(b.displayName);
            }
            return a.type.localeCompare(b.type);
        });
        sorted.forEach((node, index) => {
            layout.set(node.key, { x, y: startY + index * nodeSpacing, z: 0 });
        });
    }

    if (!layout.has(graph.center)) {
        layout.set(graph.center, { x: 0, y: 0, z: 0 });
    }

    return layout;
}

function orientEdge(edge: GraphEdge, centerKey: string) {
    if (edge.to === centerKey) {
        return { source: centerKey, target: edge.from };
    }
    return { source: edge.from, target: edge.to };
}

function getCubeGeometry(caches: ThreeCaches, size: number): THREE.BoxGeometry {
    const cached = caches.geometryBySize.get(size);
    if (cached) return cached;
    const geometry = new THREE.BoxGeometry(size, size, size);
    caches.geometryBySize.set(size, geometry);
    return geometry;
}

function getNodeTexture(caches: ThreeCaches, node: ForceNode): Promise<THREE.Texture> {
    const key = node.id;
    const cached = caches.textureByKey.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = caches.texturePromises.get(key);
    if (inFlight) return inFlight;

    const promise = sha256Hex(identiconSeed(node.type, node.raw.id))
        .then(hash => buildIdenticonSvg(hash, 64).svg)
        .then(svg => loadSvgTexture(caches, svg))
        .then(texture => {
            caches.textureByKey.set(key, texture);
            return texture;
        })
        .finally(() => {
            caches.texturePromises.delete(key);
        });

    caches.texturePromises.set(key, promise);
    return promise;
}

function loadSvgTexture(caches: ThreeCaches, svg: string): Promise<THREE.Texture> {
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return new Promise((resolve, reject) => {
        caches.textureLoader.load(
            url,
            texture => {
                texture.colorSpace = THREE.SRGBColorSpace;
                resolve(texture);
            },
            undefined,
            (error: unknown) => reject(error)
        );
    });
}
