import React from "react";
import { GraphNode } from "$/domain/metadata/MetadataGraph";
import { getMetadataTypeLabel } from "$/domain/metadata/ResourceType";
import { IdenticonAvatar } from "$/webapp/components/metadata/IdenticonAvatar";
import { MetadataGraphView } from "$/webapp/components/metadata/MetadataGraphView";
import MetadataGraphView3D from "$/webapp/components/metadata/MetadataGraphView3D";
import i18n from "$/utils/i18n";
import {
    indexJsonPackage,
    isJsonPackageGraphMode,
    JsonPackageEntry,
    JsonPackageGraphMode,
    JsonPackageIndex,
} from "$/domain/metadata/JsonPackageIndex";
import { buildJsonPackageDependencyGraph } from "$/domain/usecases/metadata/BuildJsonPackageDependencyGraphUseCase";

type JsonPackageState =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; data: JsonPackageIndex }
    | { type: "error"; error: string };

export const JsonPackageExplorer: React.FC = () => {
    const [state, setState] = React.useState<JsonPackageState>({ type: "idle" });
    const [selectedType, setSelectedType] = React.useState("");
    const [selectedEntryKey, setSelectedEntryKey] = React.useState("");
    const [filter, setFilter] = React.useState("");
    const [graphView, setGraphView] = React.useState<GraphViewMode>("layout2d");
    const [graphMode, setGraphMode] = React.useState<JsonPackageGraphMode>("direct");

    const loadFromText = React.useCallback((text: string) => {
        try {
            setState({ type: "loading" });
            const parsed = JSON.parse(text);
            const index = indexJsonPackage(parsed);
            setState({ type: "loaded", data: index });

            const firstType = index.types[0] ?? "";
            const firstEntry = firstType ? index.entriesByType[firstType]?.[0] : undefined;
            setSelectedType(firstType);
            setSelectedEntryKey(firstEntry?.key ?? "");
            setFilter("");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : i18n.t("Unknown JSON parsing error");
            setState({ type: "error", error: message });
        }
    }, []);

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = React.useCallback(
        event => {
            const file = event.target.files?.[0];
            if (!file) return;

            void file
                .text()
                .then(content => loadFromText(content))
                .catch(error => {
                    const message =
                        error instanceof Error
                            ? error.message
                            : i18n.t("Unknown JSON parsing error");
                    setState({ type: "error", error: message });
                });
        },
        [loadFromText]
    );

    const loadedData = state.type === "loaded" ? state.data : null;
    const selectedEntries = React.useMemo(
        () => (loadedData ? loadedData.entriesByType[selectedType] ?? [] : []),
        [loadedData, selectedType]
    );
    const filteredEntries = React.useMemo(
        () => filterEntries(selectedEntries, filter),
        [selectedEntries, filter]
    );

    React.useEffect(() => {
        if (!loadedData) return;
        if (!selectedType || !loadedData.entriesByType[selectedType]?.length) {
            const nextType = loadedData.types[0] ?? "";
            setSelectedType(nextType);
            setSelectedEntryKey(loadedData.entriesByType[nextType]?.[0]?.key ?? "");
        }
    }, [loadedData, selectedType]);

    React.useEffect(() => {
        if (!filteredEntries.length) {
            setSelectedEntryKey("");
            return;
        }

        const exists = filteredEntries.some(entry => entry.key === selectedEntryKey);
        if (!exists) {
            setSelectedEntryKey(filteredEntries[0]?.key ?? "");
        }
    }, [filteredEntries, selectedEntryKey]);

    const selectedEntry =
        loadedData && selectedEntryKey ? loadedData.entriesByKey.get(selectedEntryKey) : undefined;

    const graph = React.useMemo(() => {
        if (!loadedData || !selectedEntry) return null;
        return buildJsonPackageDependencyGraph(loadedData, selectedEntry.key, { mode: graphMode });
    }, [graphMode, loadedData, selectedEntry]);

    const handleFocus = React.useCallback((node: GraphNode) => {
        setSelectedType(node.type);
        setSelectedEntryKey(node.key);
    }, []);

    return (
        <div className="metadata-package">
            <div className="metadata-package__controls">
                <label className="metadata-package__file-label">
                    {i18n.t("Metadata package JSON")}
                    <input
                        type="file"
                        accept=".json,application/json"
                        className="metadata-package__file-input"
                        onChange={handleFileChange}
                    />
                </label>

                {loadedData && (
                    <>
                        <label className="metadata-package__select-label">
                            {i18n.t("Metadata type")}
                            <select
                                className="metadata-package__select"
                                value={selectedType}
                                onChange={event => setSelectedType(event.target.value)}
                            >
                                {loadedData.types.map(type => (
                                    <option key={type} value={type}>
                                        {`${getMetadataTypeLabel(type)} (${
                                            loadedData.entriesByType[type]?.length ?? 0
                                        })`}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="metadata-package__search-label">
                            {i18n.t("Search")}
                            <input
                                type="text"
                                value={filter}
                                onChange={event => setFilter(event.target.value)}
                                className="metadata-package__search-input"
                                placeholder={i18n.t("Filter by id or name")}
                            />
                        </label>
                    </>
                )}
            </div>

            {state.type === "idle" && (
                <div className="metadata-table__empty">
                    {i18n.t("Select a metadata package JSON file to start")}
                </div>
            )}

            {state.type === "error" && (
                <div className="metadata-table__empty metadata-summary__error">{state.error}</div>
            )}

            {state.type === "loading" && (
                <div className="metadata-table__empty">{i18n.t("Loading package...")}</div>
            )}

            {loadedData && (
                <>
                    <div className="metadata-package__summary">
                        {i18n.t("{{types}} types", { types: loadedData.types.length })} •{" "}
                        {i18n.t("{{items}} items", { items: countEntries(loadedData) })}
                    </div>

                    <div className="metadata-package__content">
                        <div className="metadata-package__list">
                            <div className="metadata-package__list-table-wrap">
                                <table className="metadata-table">
                                    <thead>
                                        <tr>
                                            <th className="metadata-table__cell metadata-table__cell--avatar">
                                                {i18n.t("Avatar")}
                                            </th>
                                            <th className="metadata-table__cell">id</th>
                                            <th className="metadata-table__cell">displayName</th>
                                            <th className="metadata-table__cell">type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEntries.map(entry => {
                                            const isSelected = entry.key === selectedEntryKey;
                                            return (
                                                <tr
                                                    key={entry.key}
                                                    className={
                                                        isSelected
                                                            ? "metadata-table__row metadata-table__row--active"
                                                            : "metadata-table__row"
                                                    }
                                                    onClick={() => setSelectedEntryKey(entry.key)}
                                                >
                                                    <td className="metadata-table__cell metadata-table__cell--avatar">
                                                        <IdenticonAvatar
                                                            type={entry.type}
                                                            uid={entry.id}
                                                            size={32}
                                                        />
                                                    </td>
                                                    <td className="metadata-table__cell">{entry.id}</td>
                                                    <td className="metadata-table__cell">
                                                        {entry.displayName}
                                                    </td>
                                                    <td className="metadata-table__cell">
                                                        {getMetadataTypeLabel(entry.type)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {filteredEntries.length === 0 && (
                                <div className="metadata-table__empty">
                                    {i18n.t("No results for this type/filter")}
                                </div>
                            )}
                        </div>

                        <div className="metadata-graph metadata-package__graph">
                            <div className="metadata-graph__toolbar">
                                <label
                                    className="metadata-graph__toolbar-label"
                                    htmlFor="metadata-package-graph-view"
                                >
                                    {i18n.t("Visualization")}
                                </label>
                                <select
                                    id="metadata-package-graph-view"
                                    className="metadata-graph__select"
                                    value={graphView}
                                    onChange={event => {
                                        const value = event.target.value;
                                        if (isGraphViewMode(value)) setGraphView(value);
                                    }}
                                >
                                    <option value="layout2d">{i18n.t("2D View")}</option>
                                    <option value="force3d">{i18n.t("3D Tree")}</option>
                                    <option value="timeline3d">{i18n.t("3D Timeline")}</option>
                                </select>

                                <label
                                    className="metadata-graph__toolbar-label"
                                    htmlFor="metadata-package-graph-mode"
                                >
                                    {i18n.t("Relationships")}
                                </label>
                                <select
                                    id="metadata-package-graph-mode"
                                    className="metadata-graph__select"
                                    value={graphMode}
                                    onChange={event => {
                                        const value = event.target.value;
                                        if (isJsonPackageGraphMode(value)) setGraphMode(value);
                                    }}
                                >
                                    <option value="direct">{i18n.t("Direct only")}</option>
                                    <option value="expanded">{i18n.t("Expanded")}</option>
                                </select>
                            </div>

                            {!selectedEntry && (
                                <div className="metadata-graph__placeholder">
                                    {i18n.t("Select a row to view dependencies")}
                                </div>
                            )}
                            {selectedEntry &&
                                graph &&
                                (graphView === "force3d" ? (
                                    <MetadataGraphView3D graph={graph} onFocus={handleFocus} />
                                ) : graphView === "timeline3d" ? (
                                    <MetadataGraphView3D
                                        graph={graph}
                                        onFocus={handleFocus}
                                        layoutMode="timeline"
                                    />
                                ) : (
                                    <MetadataGraphView graph={graph} onFocus={handleFocus} />
                                ))}
                        </div>
                    </div>

                    {selectedEntry && (
                        <div className="metadata-package__raw">
                            <div className="metadata-package__raw-title">
                                {i18n.t("Selected metadata JSON")}
                            </div>
                            <pre className="metadata-package__raw-content">
                                {JSON.stringify(selectedEntry.raw, null, 2)}
                            </pre>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

function filterEntries(entries: JsonPackageEntry[], search: string): JsonPackageEntry[] {
    const term = search.trim().toLowerCase();
    if (!term) return entries;

    return entries.filter(entry => {
        return (
            entry.id.toLowerCase().includes(term) ||
            entry.displayName.toLowerCase().includes(term) ||
            entry.type.toLowerCase().includes(term)
        );
    });
}

function countEntries(index: JsonPackageIndex): number {
    return index.types.reduce((acc, type) => acc + (index.entriesByType[type]?.length ?? 0), 0);
}

const graphViewModes = ["layout2d", "force3d", "timeline3d"] as const;
type GraphViewMode = (typeof graphViewModes)[number];

function isGraphViewMode(value: string): value is GraphViewMode {
    return (graphViewModes as readonly string[]).includes(value);
}
