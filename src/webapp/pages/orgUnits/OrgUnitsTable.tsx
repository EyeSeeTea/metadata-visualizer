import React from "react";
import { Id } from "$/domain/entities/Ref";
import { OrgUnitPathInfo, OrgUnitWithPath } from "$/domain/orgUnits/OrgUnit";
import i18n from "$/utils/i18n";

type SortDirection = "asc" | "desc";

type OrgUnitsTableProps = {
    items: ReadonlyArray<OrgUnitWithPath>;
    selectedId: Id | null;
    onSelect: (id: Id) => void;
};

export const OrgUnitsTable: React.FC<OrgUnitsTableProps> = ({ items, selectedId, onSelect }) => {
    const [direction, setDirection] = React.useState<SortDirection>("asc");

    const sortedItems = React.useMemo(() => sortByPath(items, direction), [items, direction]);

    const toggleDirection = React.useCallback(() => {
        setDirection(prev => (prev === "asc" ? "desc" : "asc"));
    }, []);

    return (
        <table className="orgunit-table">
            <thead>
                <tr>
                    <th>{i18n.t("Name / UID")}</th>
                    <th>{i18n.t("Level")}</th>
                    <th>{i18n.t("Coordinates")}</th>
                    <th>
                        <button
                            type="button"
                            className="orgunit-table__sort"
                            onClick={toggleDirection}
                            aria-label={i18n.t("Sort by path")}
                        >
                            {i18n.t("Path")} {direction === "asc" ? "▲" : "▼"}
                        </button>
                    </th>
                </tr>
            </thead>
            <tbody>
                {sortedItems.map(({ orgUnit, pathInfo }) => (
                    <tr
                        key={orgUnit.id}
                        className={
                            orgUnit.id === selectedId
                                ? "orgunit-table__row orgunit-table__row--selected"
                                : "orgunit-table__row"
                        }
                        onClick={() => onSelect(orgUnit.id)}
                    >
                        <td>
                            <div className="orgunit-table__name">{orgUnit.displayName}</div>
                            <div className="orgunit-table__id">{orgUnit.id}</div>
                        </td>
                        <td>{orgUnit.level}</td>
                        <td>
                            <CoordinatesCell orgUnit={orgUnit} />
                        </td>
                        <td>
                            <PathCell pathInfo={pathInfo} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const CoordinatesCell: React.FC<{ orgUnit: OrgUnitWithPath["orgUnit"] }> = ({ orgUnit }) => {
    if (!orgUnit.coordinates) return <span className="orgunit-table__muted">—</span>;

    return (
        <span className="orgunit-table__coords">
            {orgUnit.coordinates.latitude.toFixed(5)}, {orgUnit.coordinates.longitude.toFixed(5)}
        </span>
    );
};

const PathCell: React.FC<{ pathInfo: OrgUnitPathInfo }> = ({ pathInfo }) => (
    <div className="orgunit-path">
        {pathInfo.segments.map((segment, index) => (
            <React.Fragment key={segment.id}>
                {index > 0 && <span className="orgunit-path__sep">/</span>}
                <span className="orgunit-path__segment">
                    <span className="orgunit-path__name">{segment.name}</span>
                    <span className="orgunit-path__id">{segment.id}</span>
                </span>
            </React.Fragment>
        ))}
    </div>
);

function sortByPath(
    items: ReadonlyArray<OrgUnitWithPath>,
    direction: SortDirection
): OrgUnitWithPath[] {
    const factor = direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => factor * a.orgUnit.path.localeCompare(b.orgUnit.path));
}
