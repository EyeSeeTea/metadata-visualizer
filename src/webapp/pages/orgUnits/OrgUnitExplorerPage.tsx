import React from "react";
import { Id } from "$/domain/entities/Ref";
import { OrgUnitWithPath } from "$/domain/orgUnits/OrgUnit";
import { useAppContext } from "$/webapp/contexts/app-context";
import { OrgUnitsTable } from "./OrgUnitsTable";
import { OrgUnitsMapPreview } from "./OrgUnitsMapPreview";
import i18n from "$/utils/i18n";
import "./OrgUnitExplorerPage.css";

type OrgUnitState =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; items: OrgUnitWithPath[] }
    | { type: "error"; message: string };

export const OrgUnitExplorerPage: React.FC = () => {
    const { compositionRoot } = useAppContext();
    const [uidsText, setUidsText] = React.useState("");
    const [state, setState] = React.useState<OrgUnitState>({ type: "idle" });
    const [selectedId, setSelectedId] = React.useState<Id | null>(null);
    const [mapCollapsed, setMapCollapsed] = React.useState(false);

    const ids = React.useMemo(() => parseUids(uidsText), [uidsText]);

    const handleSearch = React.useCallback(() => {
        if (ids.length === 0) return;

        setSelectedId(null);
        setState({ type: "loading" });

        compositionRoot.orgUnits.getManyWithPaths.execute(ids).run(
            items => setState({ type: "loaded", items }),
            error => setState({ type: "error", message: error.message })
        );
    }, [ids, compositionRoot]);

    const toggleMapCollapsed = React.useCallback(() => setMapCollapsed(prev => !prev), []);

    return (
        <div className="orgunit-explorer">
            <div className="orgunit-explorer__search">
                <label>
                    {i18n.t("Organisation Unit UIDs")}
                    <textarea
                        value={uidsText}
                        onChange={e => setUidsText(e.target.value)}
                        placeholder={i18n.t("Paste UIDs separated by spaces, commas or new lines")}
                        rows={4}
                    />
                </label>
                <button type="button" onClick={handleSearch} disabled={ids.length === 0}>
                    {i18n.t("Search")}
                </button>
            </div>

            {state.type === "loading" && (
                <div className="orgunit-explorer__status">{i18n.t("Loading...")}</div>
            )}

            {state.type === "error" && (
                <div className="orgunit-explorer__status orgunit-explorer__status--error">
                    {state.message}
                </div>
            )}

            {state.type === "loaded" && state.items.length === 0 && (
                <div className="orgunit-explorer__status">
                    {i18n.t("No organisation units found for the provided UIDs")}
                </div>
            )}

            {state.type === "loaded" && state.items.length > 0 && (
                <div
                    className={
                        mapCollapsed
                            ? "orgunit-explorer__content orgunit-explorer__content--map-collapsed"
                            : "orgunit-explorer__content"
                    }
                >
                    <div className="orgunit-explorer__detail">
                        <OrgUnitsTable
                            items={state.items}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    </div>
                    <div className="orgunit-explorer__map">
                        <OrgUnitsMapPreview
                            orgUnits={state.items.map(item => item.orgUnit)}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            collapsed={mapCollapsed}
                            onToggleCollapse={toggleMapCollapsed}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

function parseUids(text: string): string[] {
    return [...new Set(text.split(/[\s,]+/).filter(token => token.length > 0))];
}
