import React from "react";
import { MetadataItem } from "$/domain/metadata/MetadataItem";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { IdenticonAvatar } from "$/webapp/components/metadata/IdenticonAvatar";

type MetadataTableProps = {
    items: MetadataItem[];
    type: ResourceType;
    fields: string;
    selectedId?: string | null;
    onSelect: (item: MetadataItem) => void;
};

export const MetadataTable: React.FC<MetadataTableProps> = ({
    items,
    type,
    fields,
    selectedId,
    onSelect,
}) => {
    const columns = React.useMemo(() => buildColumns(fields), [fields]);

    if (!items.length) {
        return <div className="metadata-table__empty">No results</div>;
    }

    return (
        <table className="metadata-table">
            <thead>
                <tr>
                    <th className="metadata-table__cell metadata-table__cell--avatar">Avatar</th>
                    {columns.map(column => (
                        <th key={column} className="metadata-table__cell">
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {items.map(item => {
                    const displayName = item.displayName ?? item.name ?? item.id;
                    const isSelected = selectedId === item.id;
                    return (
                        <tr
                            key={item.id}
                            className={
                                isSelected
                                    ? "metadata-table__row metadata-table__row--active"
                                    : "metadata-table__row"
                            }
                            onClick={() => onSelect(item)}
                        >
                            <td className="metadata-table__cell metadata-table__cell--avatar">
                                <IdenticonAvatar type={type} uid={item.id} size={32} />
                            </td>
                            {columns.map(column => (
                                <td key={column} className="metadata-table__cell">
                                    {column === "displayName"
                                        ? displayName
                                        : formatValue(item[column])}
                                </td>
                            ))}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

function buildColumns(fields: string): string[] {
    const tokens = fields
        .split(",")
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => token.split("[")[0]);

    const base = ["id", "displayName"];
    const unique = new Set<string>(base);
    tokens.forEach(token => {
        if (token && !unique.has(token)) {
            unique.add(token);
        }
    });

    return Array.from(unique);
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (Array.isArray(value)) {
        if (!value.length) return "0";
        const names = value
            .map(entry => {
                if (entry && typeof entry === "object") {
                    const candidate = entry as { displayName?: string; name?: string; id?: string };
                    return candidate.displayName ?? candidate.name ?? candidate.id ?? "[item]";
                }
                return String(entry);
            })
            .filter(Boolean);
        const preview = names.slice(0, 3).join(", ");
        return names.length > 3 ? `${preview} +${names.length - 3}` : preview;
    }
    if (typeof value === "object") {
        const candidate = value as { displayName?: string; name?: string; id?: string };
        return candidate.displayName ?? candidate.name ?? candidate.id ?? "[object]";
    }
    return String(value);
}
