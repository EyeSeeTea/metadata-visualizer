import React from "react";
import { MetadataItem } from "$/domain/metadata/MetadataItem";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { getTopLevelFieldName, splitTopLevelFields } from "$/domain/metadata/fields";
import { IdenticonAvatar } from "$/webapp/components/metadata/IdenticonAvatar";
import i18n from "$/utils/i18n";

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
        return <div className="metadata-table__empty">{i18n.t("No results")}</div>;
    }

    return (
        <table className="metadata-table">
            <thead>
                <tr>
                    <th className="metadata-table__cell metadata-table__cell--avatar">
                        {i18n.t("Avatar")}
                    </th>
                    {columns.map(column => (
                        <th key={column.key} className="metadata-table__cell">
                            {column.key}
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
                                <td key={column.key} className="metadata-table__cell">
                                    {column.key === "displayName"
                                        ? displayName
                                        : formatValue(item[column.key])}
                                </td>
                            ))}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

type Column = {
    key: string;
};

function buildColumns(fields: string): Column[] {
    const requestedKeys = splitTopLevelFields(fields)
        .map(getTopLevelFieldName)
        .filter(key => key.length > 0);

    const keys = ["id", "displayName", ...requestedKeys];
    const uniqueKeys = Array.from(new Set(keys));

    return uniqueKeys.map(key => ({ key }));
}

function formatValue(value: unknown): string {
    return toText(value);
}

function toText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(toText).filter(Boolean).join(" | ");
    }
    if (typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .map(([key, entryValue]) => `${key}: ${toText(entryValue)}`)
            .join(" ");
    }
    return "";
}
