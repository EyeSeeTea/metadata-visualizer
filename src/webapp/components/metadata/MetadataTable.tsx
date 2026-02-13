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
    const requestedKeys = splitTopLevel(fields)
        .map(getTopLevelKey)
        .filter((key): key is string => Boolean(key));

    const keys = ["id", "displayName", ...requestedKeys];
    const uniqueKeys = Array.from(new Set(keys));

    return uniqueKeys.map(key => ({ key }));
}

function getTopLevelKey(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) return "";
    const bracketIndex = trimmed.indexOf("[");
    return (bracketIndex === -1 ? trimmed : trimmed.slice(0, bracketIndex)).trim();
}

function splitTopLevel(value: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of value) {
        if (char === "[") {
            depth += 1;
            current += char;
            continue;
        }

        if (char === "]") {
            depth = Math.max(0, depth - 1);
            current += char;
            continue;
        }

        if (char === "," && depth === 0) {
            const token = current.trim();
            if (token) tokens.push(token);
            current = "";
            continue;
        }

        current += char;
    }

    const lastToken = current.trim();
    if (lastToken) tokens.push(lastToken);

    return tokens;
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
