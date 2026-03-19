import React from "react";
import { OrgUnit, OrgUnitPathInfo } from "$/domain/orgUnits/OrgUnit";
import { useAppContext } from "$/webapp/contexts/app-context";
import { OrgUnitDetailCard } from "./OrgUnitDetailCard";
import { OrgUnitMapPreview } from "./OrgUnitMapPreview";
import i18n from "$/utils/i18n";
import "./OrgUnitExplorerPage.css";

type OrgUnitState =
    | { type: "idle" }
    | { type: "loading" }
    | { type: "loaded"; orgUnit: OrgUnit; pathInfo: OrgUnitPathInfo }
    | { type: "error"; message: string };

export const OrgUnitExplorerPage: React.FC = () => {
    const { compositionRoot } = useAppContext();
    const [uid, setUid] = React.useState("");
    const [state, setState] = React.useState<OrgUnitState>({ type: "idle" });

    const handleSearch = React.useCallback(() => {
        const trimmedUid = uid.trim();
        if (!trimmedUid) return;

        setState({ type: "loading" });

        compositionRoot.orgUnits.getById
            .execute(trimmedUid)
            .flatMap(orgUnit =>
                compositionRoot.orgUnits.getPathInfo.execute(orgUnit.path).map(pathInfo => ({
                    orgUnit,
                    pathInfo,
                }))
            )
            .run(
                ({ orgUnit, pathInfo }) => {
                    setState({ type: "loaded", orgUnit, pathInfo });
                },
                error => {
                    setState({ type: "error", message: error.message });
                }
            );
    }, [uid, compositionRoot]);

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === "Enter") handleSearch();
        },
        [handleSearch]
    );

    return (
        <div className="orgunit-explorer">
            <div className="orgunit-explorer__search">
                <label>
                    {i18n.t("Organisation Unit UID")}
                    <input
                        type="text"
                        value={uid}
                        onChange={e => setUid(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. ImspTQPwCqd"
                    />
                </label>
                <button type="button" onClick={handleSearch} disabled={!uid.trim()}>
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

            {state.type === "loaded" && (
                <div className="orgunit-explorer__content">
                    <div className="orgunit-explorer__detail">
                        <OrgUnitDetailCard orgUnit={state.orgUnit} pathInfo={state.pathInfo} />
                    </div>
                    <div className="orgunit-explorer__map">
                        <OrgUnitMapPreview orgUnit={state.orgUnit} />
                    </div>
                </div>
            )}
        </div>
    );
};
