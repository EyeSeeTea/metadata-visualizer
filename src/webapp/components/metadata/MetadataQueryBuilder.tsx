import React from "react";
import {
    resourceTypeLabels,
    selectableResourceTypes,
    ResourceType,
} from "$/domain/metadata/ResourceType";

export type MetadataQueryState = {
    type: ResourceType;
    fields: string;
    filters: string;
    page: number;
    pageSize: number;
    paging: boolean;
};

type MetadataQueryBuilderProps = {
    value: MetadataQueryState;
    onChange: (next: MetadataQueryState) => void;
    onTypeChange: (nextType: ResourceType) => void;
    onRun: () => void;
};

export const MetadataQueryBuilder: React.FC<MetadataQueryBuilderProps> = ({
    value,
    onChange,
    onTypeChange,
    onRun,
}) => {
    return (
        <section className="metadata-query">
            <div className="metadata-query__row">
                <label className="metadata-query__label">
                    Resource type
                    <select
                        className="metadata-query__input"
                        value={value.type}
                        onChange={event => onTypeChange(event.target.value as ResourceType)}
                    >
                        {selectableResourceTypes.map(type => (
                            <option key={type} value={type}>
                                {resourceTypeLabels[type]}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="metadata-query__label">
                    Fields
                    <input
                        className="metadata-query__input"
                        type="text"
                        value={value.fields}
                        onChange={event => onChange({ ...value, fields: event.target.value })}
                        placeholder="id,displayName"
                    />
                </label>
            </div>

            <div className="metadata-query__row">
                <label className="metadata-query__label metadata-query__label--grow">
                    Filters (one per line or separated by ;)
                    <textarea
                        className="metadata-query__input metadata-query__textarea"
                        value={value.filters}
                        onChange={event => onChange({ ...value, filters: event.target.value })}
                        placeholder="displayName:ilike:malaria"
                        rows={2}
                    />
                </label>
            </div>

            <div className="metadata-query__row metadata-query__row--compact">
                <label className="metadata-query__label">
                    Page
                    <input
                        className="metadata-query__input metadata-query__input--number"
                        type="number"
                        min={1}
                        value={value.page}
                        disabled={!value.paging}
                        onChange={event =>
                            onChange({
                                ...value,
                                page: Math.max(1, Number(event.target.value || 1)),
                            })
                        }
                    />
                </label>
                <label className="metadata-query__label">
                    Page size
                    <input
                        className="metadata-query__input metadata-query__input--number"
                        type="number"
                        min={1}
                        max={200}
                        value={value.pageSize}
                        disabled={!value.paging}
                        onChange={event =>
                            onChange({
                                ...value,
                                pageSize: Math.min(
                                    200,
                                    Math.max(1, Number(event.target.value || 1))
                                ),
                            })
                        }
                    />
                </label>

                <label className="metadata-query__checkbox">
                    <input
                        type="checkbox"
                        checked={!value.paging}
                        onChange={event =>
                            onChange({ ...value, paging: !event.target.checked, page: 1 })
                        }
                    />
                    Fetch all (paging=false)
                </label>

                <button className="metadata-query__button" type="button" onClick={onRun}>
                    Fetch
                </button>
            </div>
        </section>
    );
};
