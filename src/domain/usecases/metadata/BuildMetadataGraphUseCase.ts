import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { splitDataSetsByOverride } from "$/domain/metadata/dataset-splits";
import {
    GraphEdge,
    GraphGroup,
    GraphNode,
    MetadataGraph,
    graphNodeKey,
} from "$/domain/metadata/MetadataGraph";
import { MetadataItem, MetadataList } from "$/domain/metadata/MetadataItem";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

type Named = { id: string; displayName?: string; name?: string };

/**
 * Maximum number of ids to put into a single `id:in:[...]` filter. Keeps the
 * URL under DHIS2's practical request limit while still cutting request count
 * by ~50x vs. one-request-per-id.
 */
const ID_CHUNK_SIZE = 50;

const PARALLEL_OPTIONS = { concurrency: 4 };

const DATA_SET_FIELDS =
    "id,displayName,categoryCombo[id,displayName],dataSetElements[dataElement[id,displayName,categoryCombo[id,displayName]],categoryCombo[id,displayName]]";

export class BuildMetadataGraphUseCase {
    constructor(private options: { metadataRepository: MetadataRepository }) {}

    public execute(input: { type: ResourceType; id: string }): FutureData<MetadataGraph> {
        switch (input.type) {
            case "dataElements":
                return this.buildDataElementGraph(input.id);
            case "categoryCombos":
                return this.buildCategoryComboGraph(input.id);
            case "categories":
                return this.buildCategoryGraph(input.id);
            case "categoryOptions":
                return this.buildCategoryOptionGraph(input.id);
            case "categoryOptionCombos":
                return this.buildCategoryOptionComboGraph(input.id);
            case "dataSets":
                return this.buildDataSetGraph(input.id);
            default:
                return Future.error(new Error(`Unsupported metadata type: ${input.type}`));
        }
    }

    private buildDataElementGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const dataElement = asDataElement(
                await $(
                    this.options.metadataRepository.get(
                        "dataElements",
                        id,
                        "id,displayName,categoryCombo[id,displayName,categories[id,displayName,categoryOptions[id,displayName]]]"
                    )
                )
            );

            const dataSetsByElement = await $(this.listDataSetsByDataElementIds([dataElement]));
            const { plain: dataSetsPlain, overrides: dataSetsOverride } = splitDataSetsByOverride(
                dataSetsByElement.items
            );

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("dataElements", dataElement);

            const combo = dataElement.categoryCombo;
            const comboKey = combo ? addNode("categoryCombos", combo) : null;
            if (comboKey) {
                addEdge(centerKey, comboKey, "categoryCombo");
            }

            const { categoryKeys, optionKeys } = addCategories(combo, comboKey, addNode, addEdge);

            const dataSetKeys = dataSetsPlain.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSets");
                return key;
            });

            const dataSetOverrideKeys = dataSetsOverride.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSetsOverride");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "category-combo",
                    title: "Category combo",
                    nodeKeys: comboKey ? [comboKey] : [],
                    direction: "parent",
                },
                {
                    id: "categories",
                    title: "Categories",
                    nodeKeys: categoryKeys,
                    direction: "child",
                },
                {
                    id: "category-options",
                    title: "Category options",
                    nodeKeys: optionKeys,
                    direction: "child",
                },
                { id: "data-sets", title: "Data sets", nodeKeys: dataSetKeys, direction: "parent" },
                {
                    id: "data-sets-override",
                    title: "Data sets (override)",
                    nodeKeys: dataSetOverrideKeys,
                    direction: "parent",
                },
            ]);

            return {
                center: centerKey,
                nodes: getNodes(),
                edges,
                groups,
                lazy: combo ? { categoryOptionCombos: { categoryComboId: combo.id } } : undefined,
            };
        });
    }

    private buildCategoryComboGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const combo = asCategoryCombo(
                await $(
                    this.options.metadataRepository.get(
                        "categoryCombos",
                        id,
                        "id,displayName,categories[id,displayName,categoryOptions[id,displayName]]"
                    )
                )
            );

            const dataElementsList = await $(
                this.options.metadataRepository.list({
                    type: "dataElements",
                    fields: "id,displayName",
                    filters: [`categoryCombo.id:eq:${id}`],
                    paging: false,
                })
            );

            const dataSetsByCombo = await $(this.listDataSetsByCategoryComboIds([combo]));

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("categoryCombos", combo);

            const { categoryKeys, optionKeys } = addCategories(combo, centerKey, addNode, addEdge);

            const dataElementKeys = dataElementsList.items.map(item => {
                const key = addNode("dataElements", item);
                addEdge(centerKey, key, "dataElements");
                return key;
            });

            const dataSetKeys = dataSetsByCombo.items.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSets");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "categories",
                    title: "Categories",
                    nodeKeys: categoryKeys,
                    direction: "child",
                },
                {
                    id: "category-options",
                    title: "Category options",
                    nodeKeys: optionKeys,
                    direction: "child",
                },
                {
                    id: "data-elements",
                    title: "Data elements",
                    nodeKeys: dataElementKeys,
                    direction: "parent",
                },
                { id: "data-sets", title: "Data sets", nodeKeys: dataSetKeys, direction: "parent" },
            ]);

            return {
                center: centerKey,
                nodes: getNodes(),
                edges,
                groups,
                lazy: { categoryOptionCombos: { categoryComboId: combo.id } },
            };
        });
    }

    private buildCategoryGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const category = asCategory(
                await $(
                    this.options.metadataRepository.get(
                        "categories",
                        id,
                        "id,displayName,categoryOptions[id,displayName]"
                    )
                )
            );

            const combosList = await $(
                this.options.metadataRepository.list({
                    type: "categoryCombos",
                    fields: "id,displayName",
                    filters: [`categories.id:eq:${id}`],
                    paging: false,
                })
            );

            const dataSetsByCombo = await $(this.listDataSetsByCategoryComboIds(combosList.items));

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("categories", category);

            const comboKeys = combosList.items.map(combo => {
                const key = addNode("categoryCombos", combo);
                addEdge(key, centerKey, "categories");
                return key;
            });

            const optionKeys = (category.categoryOptions ?? []).map(option => {
                const key = addNode("categoryOptions", option);
                addEdge(centerKey, key, "categoryOptions");
                return key;
            });

            const dataSetKeys = dataSetsByCombo.items.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSets");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "category-combos",
                    title: "Category combos",
                    nodeKeys: comboKeys,
                    direction: "parent",
                },
                {
                    id: "category-options",
                    title: "Category options",
                    nodeKeys: optionKeys,
                    direction: "child",
                },
                { id: "data-sets", title: "Data sets", nodeKeys: dataSetKeys, direction: "parent" },
            ]);

            return { center: centerKey, nodes: getNodes(), edges, groups };
        });
    }

    private buildCategoryOptionGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const option = asCategoryOption(
                await $(
                    this.options.metadataRepository.get("categoryOptions", id, "id,displayName")
                )
            );

            const categoriesList = await $(
                this.options.metadataRepository.list({
                    type: "categories",
                    fields: "id,displayName",
                    filters: [`categoryOptions.id:eq:${id}`],
                    paging: false,
                })
            );

            const categoryCombosList = await $(
                this.listCategoryCombosByCategories(categoriesList.items)
            );
            const dataElementsList = await $(
                this.listDataElementsByCategoryCombos(categoryCombosList.items)
            );
            const dataSetsByCombo = await $(
                this.listDataSetsByCategoryComboIds(categoryCombosList.items)
            );
            const dataSetsByElements = await $(
                this.listDataSetsByDataElementIds(dataElementsList.items)
            );
            const { plain: dataSetsPlain, overrides: dataSetsOverride } = splitDataSetsByOverride(
                dataSetsByElements.items
            );
            const categoryOptionCombosList = await $(
                this.options.metadataRepository.list({
                    type: "categoryOptionCombos",
                    fields: "id,displayName",
                    filters: [`categoryOptions.id:eq:${id}`],
                    paging: false,
                })
            );

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("categoryOptions", option);

            const categoryKeys = categoriesList.items.map(category => {
                const key = addNode("categories", category);
                addEdge(key, centerKey, "categoryOptions");
                return key;
            });

            const dataElementKeys = dataElementsList.items.map(item => {
                const key = addNode("dataElements", item);
                addEdge(key, centerKey, "dataElements");
                return key;
            });

            const overrideIds = new Set(dataSetsOverride.map(override => override.id));
            const dataSetKeys = uniqueById(
                [...dataSetsPlain, ...dataSetsByCombo.items].filter(
                    item => !overrideIds.has(item.id)
                )
            ).map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSets");
                return key;
            });

            const dataSetOverrideKeys = dataSetsOverride.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSetsOverride");
                return key;
            });

            const optionComboKeys = categoryOptionCombosList.items.map(item => {
                const key = addNode("categoryOptionCombos", item);
                addEdge(centerKey, key, "categoryOptionCombos");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "categories",
                    title: "Categories",
                    nodeKeys: categoryKeys,
                    direction: "parent",
                },
                {
                    id: "data-elements",
                    title: "Data elements",
                    nodeKeys: dataElementKeys,
                    direction: "parent",
                },
                { id: "data-sets", title: "Data sets", nodeKeys: dataSetKeys, direction: "parent" },
                {
                    id: "data-sets-override",
                    title: "Data sets (override)",
                    nodeKeys: dataSetOverrideKeys,
                    direction: "parent",
                },
                {
                    id: "category-option-combos",
                    title: "Category option combos",
                    nodeKeys: optionComboKeys,
                    direction: "child",
                },
            ]);

            return { center: centerKey, nodes: getNodes(), edges, groups };
        });
    }

    private buildCategoryOptionComboGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const coc = asCategoryOptionCombo(
                await $(
                    this.options.metadataRepository.get(
                        "categoryOptionCombos",
                        id,
                        "id,displayName,categoryCombo[id,displayName],categoryOptions[id,displayName]"
                    )
                )
            );

            const dataElementsList = coc.categoryCombo
                ? await $(this.listDataElementsByCategoryCombos([coc.categoryCombo]))
                : { items: [] as MetadataItem[] };
            const dataSetsByCombo = coc.categoryCombo
                ? await $(this.listDataSetsByCategoryComboIds([coc.categoryCombo]))
                : { items: [] as MetadataItem[] };
            const dataSetsByElements = await $(
                this.listDataSetsByDataElementIds(dataElementsList.items)
            );
            const { plain: dataSetsPlain, overrides: dataSetsOverride } = splitDataSetsByOverride(
                dataSetsByElements.items
            );

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("categoryOptionCombos", coc);

            const comboKey = coc.categoryCombo
                ? addNode("categoryCombos", coc.categoryCombo)
                : null;
            if (comboKey) {
                addEdge(comboKey, centerKey, "categoryOptionCombos");
            }

            const optionKeys = (coc.categoryOptions ?? []).map(option => {
                const key = addNode("categoryOptions", option);
                addEdge(centerKey, key, "categoryOptions");
                return key;
            });

            const dataElementKeys = dataElementsList.items.map(item => {
                const key = addNode("dataElements", item);
                addEdge(key, centerKey, "dataElements");
                return key;
            });

            const overrideIds = new Set(dataSetsOverride.map(override => override.id));
            const dataSetKeys = uniqueById(
                [...dataSetsPlain, ...dataSetsByCombo.items].filter(
                    item => !overrideIds.has(item.id)
                )
            ).map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSets");
                return key;
            });

            const dataSetOverrideKeys = dataSetsOverride.map(item => {
                const key = addNode("dataSets", item);
                addEdge(key, centerKey, "dataSetsOverride");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "category-combo",
                    title: "Category combo",
                    nodeKeys: comboKey ? [comboKey] : [],
                    direction: "parent",
                },
                {
                    id: "category-options",
                    title: "Category options",
                    nodeKeys: optionKeys,
                    direction: "child",
                },
                {
                    id: "data-elements",
                    title: "Data elements",
                    nodeKeys: dataElementKeys,
                    direction: "parent",
                },
                { id: "data-sets", title: "Data sets", nodeKeys: dataSetKeys, direction: "parent" },
                {
                    id: "data-sets-override",
                    title: "Data sets (override)",
                    nodeKeys: dataSetOverrideKeys,
                    direction: "parent",
                },
            ]);

            return { center: centerKey, nodes: getNodes(), edges, groups };
        });
    }

    private buildDataSetGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const dataSet = asDataSet(
                await $(
                    this.options.metadataRepository.get(
                        "dataSets",
                        id,
                        "id,displayName,categoryCombo[id,displayName,categories[id,displayName,categoryOptions[id,displayName]]],dataSetElements[dataElement[id,displayName,categoryCombo[id,displayName]],categoryCombo[id,displayName]]"
                    )
                )
            );

            const { getNodes, edges, addNode, addEdge } = graphBuilder();
            const centerKey = addNode("dataSets", dataSet);

            const combo = dataSet.categoryCombo;
            const comboKey = combo ? addNode("categoryCombos", combo) : null;
            if (comboKey) {
                addEdge(comboKey, centerKey, "categoryCombo");
            }

            const { categoryKeys, optionKeys } = addCategories(combo, comboKey, addNode, addEdge);

            const dataElements = uniqueById(
                (dataSet.dataSetElements ?? [])
                    .map(element => element.dataElement)
                    .filter((item): item is MetadataItem => Boolean(item))
            );

            const dataElementKeys = dataElements.map(item => {
                const key = addNode("dataElements", item);
                addEdge(centerKey, key, "dataElements");
                return key;
            });

            const overrideCombos = uniqueById(
                (dataSet.dataSetElements ?? [])
                    .filter(element => {
                        const overrideId = element.categoryCombo?.id;
                        const defaultId = element.dataElement?.categoryCombo?.id;
                        return Boolean(overrideId && overrideId !== defaultId);
                    })
                    .map(element => element.categoryCombo)
                    .filter((item): item is MetadataItem => Boolean(item))
            );

            const overrideComboKeys = overrideCombos.map(item => {
                const key = addNode("categoryCombos", item);
                addEdge(key, centerKey, "categoryComboOverride");
                return key;
            });

            const groups = buildGroups([
                {
                    id: "category-combo",
                    title: "Category combo",
                    nodeKeys: comboKey ? [comboKey] : [],
                    direction: "parent",
                },
                {
                    id: "category-combos-override",
                    title: "Category combos (override)",
                    nodeKeys: overrideComboKeys,
                    direction: "parent",
                },
                {
                    id: "categories",
                    title: "Categories",
                    nodeKeys: categoryKeys,
                    direction: "child",
                },
                {
                    id: "category-options",
                    title: "Category options",
                    nodeKeys: optionKeys,
                    direction: "child",
                },
                {
                    id: "data-elements",
                    title: "Data elements",
                    nodeKeys: dataElementKeys,
                    direction: "child",
                },
            ]);

            return {
                center: centerKey,
                nodes: getNodes(),
                edges,
                groups,
                lazy: combo ? { categoryOptionCombos: { categoryComboId: combo.id } } : undefined,
            };
        });
    }

    private listCategoryCombosByCategories(categories: MetadataItem[]): FutureData<MetadataList> {
        return this.listByInFilter({
            type: "categoryCombos",
            fields: "id,displayName",
            filterField: "categories.id",
            ids: categories.map(category => category.id),
        });
    }

    private listDataElementsByCategoryCombos(
        categoryCombos: MetadataItem[]
    ): FutureData<MetadataList> {
        return this.listByInFilter({
            type: "dataElements",
            fields: "id,displayName",
            filterField: "categoryCombo.id",
            ids: categoryCombos.map(combo => combo.id),
        });
    }

    private listDataSetsByCategoryComboIds(
        categoryCombos: MetadataItem[]
    ): FutureData<MetadataList> {
        return this.listByInFilter({
            type: "dataSets",
            fields: DATA_SET_FIELDS,
            filterField: "categoryCombo.id",
            ids: categoryCombos.map(combo => combo.id),
        });
    }

    private listDataSetsByDataElementIds(dataElements: MetadataItem[]): FutureData<MetadataList> {
        return this.listByInFilter({
            type: "dataSets",
            fields: DATA_SET_FIELDS,
            filterField: "dataSetElements.dataElement.id",
            ids: dataElements.map(element => element.id),
        });
    }

    /**
     * Fan-out helper: for a list of ids, issues one `<field>:in:[id1,id2,...]`
     * request per chunk (parallelised) and returns the deduplicated union of
     * results. Chunking keeps the request URL under DHIS2's practical limit.
     */
    private listByInFilter(options: {
        type: ResourceType;
        fields: string;
        filterField: string;
        ids: ReadonlyArray<string>;
    }): FutureData<MetadataList> {
        const uniqueIds = Array.from(new Set(options.ids));
        if (uniqueIds.length === 0) {
            return Future.success({ items: [] });
        }

        const chunks = chunk(uniqueIds, ID_CHUNK_SIZE);
        const requests = chunks.map(chunkIds =>
            this.options.metadataRepository.list({
                type: options.type,
                fields: options.fields,
                filters: [`${options.filterField}:in:[${chunkIds.join(",")}]`],
                paging: false,
            })
        );

        return Future.parallel(requests, PARALLEL_OPTIONS).map(lists => ({
            items: uniqueById(lists.flatMap(list => list.items)),
        }));
    }
}

// --- Parsed response shapes (structural, not runtime-validated) ----------

type CategoryOption = MetadataItem & { displayName?: string; name?: string };
type Category = MetadataItem & { categoryOptions?: CategoryOption[] };
type CategoryCombo = MetadataItem & { categories?: Category[] };
type DataElement = MetadataItem & { categoryCombo?: CategoryCombo };
type CategoryOptionCombo = MetadataItem & {
    categoryCombo?: CategoryCombo;
    categoryOptions?: CategoryOption[];
};
type DataSetElement = {
    dataElement?: DataElement;
    categoryCombo?: CategoryCombo;
};
type DataSet = MetadataItem & {
    categoryCombo?: CategoryCombo;
    dataSetElements?: DataSetElement[];
};

// Narrowing helpers. Each validates only the fields the corresponding
// buildXGraph actually reads, so that missing nested structures are treated
// as "empty" rather than as payload errors. When a field is present but has
// the wrong shape we throw with a clear message rather than silently
// producing a broken graph.

function asDataElement(item: MetadataItem): DataElement {
    assertOptionalCategoryCombo(item, "dataElement");
    return item as DataElement;
}

function asCategoryCombo(item: MetadataItem): CategoryCombo {
    assertOptionalCategoryArray(item, "categoryCombo");
    return item as CategoryCombo;
}

function asCategory(item: MetadataItem): Category {
    assertOptionalCategoryOptionArray(item, "category");
    return item as Category;
}

function asCategoryOption(item: MetadataItem): CategoryOption {
    return item as CategoryOption;
}

function asCategoryOptionCombo(item: MetadataItem): CategoryOptionCombo {
    assertOptionalCategoryCombo(item, "categoryOptionCombo");
    assertOptionalCategoryOptionArray(item, "categoryOptionCombo");
    return item as CategoryOptionCombo;
}

function asDataSet(item: MetadataItem): DataSet {
    assertOptionalCategoryCombo(item, "dataSet");
    const elements = (item as { dataSetElements?: unknown }).dataSetElements;
    if (elements !== undefined && !Array.isArray(elements)) {
        throw new Error("BuildMetadataGraphUseCase: dataSet.dataSetElements must be an array");
    }
    return item as DataSet;
}

function assertOptionalCategoryCombo(item: MetadataItem, owner: string): void {
    const combo = (item as { categoryCombo?: unknown }).categoryCombo;
    if (combo !== undefined && (typeof combo !== "object" || combo === null)) {
        throw new Error(`BuildMetadataGraphUseCase: ${owner}.categoryCombo must be an object`);
    }
}

function assertOptionalCategoryArray(item: MetadataItem, owner: string): void {
    const categories = (item as { categories?: unknown }).categories;
    if (categories !== undefined && !Array.isArray(categories)) {
        throw new Error(`BuildMetadataGraphUseCase: ${owner}.categories must be an array`);
    }
}

function assertOptionalCategoryOptionArray(item: MetadataItem, owner: string): void {
    const options = (item as { categoryOptions?: unknown }).categoryOptions;
    if (options !== undefined && !Array.isArray(options)) {
        throw new Error(`BuildMetadataGraphUseCase: ${owner}.categoryOptions must be an array`);
    }
}

// --- Graph builder utilities ---------------------------------------------

function graphBuilder() {
    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const addNode = (type: ResourceType, item: Named) => {
        const key = graphNodeKey(type, item.id);
        if (!nodesMap.has(key)) {
            nodesMap.set(key, {
                key,
                type,
                id: item.id,
                displayName: item.displayName ?? item.name ?? item.id,
            });
        }
        return key;
    };

    const addEdge = (from: string, to: string, label: string) => {
        edges.push({ from, to, label });
    };

    return {
        edges,
        addNode,
        addEdge,
        getNodes: () => Array.from(nodesMap.values()),
    };
}

function addCategories(
    combo: CategoryCombo | undefined,
    comboKey: string | null,
    addNode: (type: ResourceType, item: Named) => string,
    addEdge: (from: string, to: string, label: string) => void
) {
    const categoryKeys = new Set<string>();
    const optionKeys = new Set<string>();

    (combo?.categories ?? []).forEach(category => {
        const categoryKey = addNode("categories", category);
        categoryKeys.add(categoryKey);
        if (comboKey) {
            addEdge(comboKey, categoryKey, "categories");
        }
        (category.categoryOptions ?? []).forEach(option => {
            const optionKey = addNode("categoryOptions", option);
            optionKeys.add(optionKey);
            addEdge(categoryKey, optionKey, "categoryOptions");
        });
    });

    return { categoryKeys: Array.from(categoryKeys), optionKeys: Array.from(optionKeys) };
}

function buildGroups(groups: GraphGroup[]) {
    return groups.filter(group => group.nodeKeys.length > 0);
}

function uniqueById(items: MetadataItem[]): MetadataItem[] {
    return Array.from(
        items
            .reduce<Map<string, MetadataItem>>((map, item) => map.set(item.id, item), new Map())
            .values()
    );
}

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
    if (size <= 0) return [items.slice()];
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, index * size + size)
    );
}
