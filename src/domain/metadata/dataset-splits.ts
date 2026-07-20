import { MetadataItem } from "$/domain/metadata/MetadataItem";

/**
 * A DHIS2 DataSet whose `dataSetElements` may override the default
 * `categoryCombo` of a referenced DataElement. We keep only the fields
 * we actually read when classifying.
 */
export type DataSetWithElements = MetadataItem & {
    categoryCombo?: MetadataItem;
    dataSetElements?: ReadonlyArray<{
        dataElement?: { categoryCombo?: { id?: string } };
        categoryCombo?: { id?: string };
    }>;
};

export type DataSetSplit = {
    plain: ReadonlyArray<DataSetWithElements>;
    overrides: ReadonlyArray<DataSetWithElements>;
};

/**
 * Partitions a list of data sets into those with and without at least one
 * data set element overriding the data element's default category combo.
 */
export function splitDataSetsByOverride(dataSets: ReadonlyArray<MetadataItem>): DataSetSplit {
    return dataSets.reduce<{ plain: DataSetWithElements[]; overrides: DataSetWithElements[] }>(
        (acc, item) => {
            const dataSet = item as DataSetWithElements;
            const hasOverride = (dataSet.dataSetElements ?? []).some(element => {
                const overrideCombo = element.categoryCombo?.id;
                const defaultCombo = element.dataElement?.categoryCombo?.id;
                return Boolean(overrideCombo && defaultCombo && overrideCombo !== defaultCombo);
            });
            return hasOverride
                ? { plain: acc.plain, overrides: [...acc.overrides, dataSet] }
                : { plain: [...acc.plain, dataSet], overrides: acc.overrides };
        },
        { plain: [], overrides: [] }
    );
}
