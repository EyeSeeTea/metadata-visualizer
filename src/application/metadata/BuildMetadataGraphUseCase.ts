import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
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

export class BuildMetadataGraphUseCase {
    constructor(private options: { metadataRepository: MetadataRepository }) {}

    public execute(input: { type: ResourceType; id: string }): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            switch (input.type) {
                case "dataElements":
                    return await $(this.buildDataElementGraph(input.id));
                case "categoryCombos":
                    return await $(this.buildCategoryComboGraph(input.id));
                case "categories":
                    return await $(this.buildCategoryGraph(input.id));
                case "categoryOptions":
                    return await $(this.buildCategoryOptionGraph(input.id));
                case "categoryOptionCombos":
                    return await $(this.buildCategoryOptionComboGraph(input.id));
                case "dataSets":
                    return await $(this.buildDataSetGraph(input.id));
                default:
                    throw new Error(`Unsupported metadata type: ${input.type}`);
            }
        });
    }

    private buildDataElementGraph(id: string): FutureData<MetadataGraph> {
        return Future.block(async $ => {
            const dataElement = (await $(
                this.options.metadataRepository.get(
                    "dataElements",
                    id,
                    "id,displayName,categoryCombo[id,displayName,categories[id,displayName,categoryOptions[id,displayName]]]"
                )
            )) as DataElement;

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
            const combo = (await $(
                this.options.metadataRepository.get(
                    "categoryCombos",
                    id,
                    "id,displayName,categories[id,displayName,categoryOptions[id,displayName]]"
                )
            )) as CategoryCombo;

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
            const category = (await $(
                this.options.metadataRepository.get(
                    "categories",
                    id,
                    "id,displayName,categoryOptions[id,displayName]"
                )
            )) as Category;

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
            const option = (await $(
                this.options.metadataRepository.get("categoryOptions", id, "id,displayName")
            )) as CategoryOption;

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

            const dataSetKeys = uniqueById(
                [...dataSetsPlain, ...dataSetsByCombo.items].filter(
                    item => !dataSetsOverride.some(override => override.id === item.id)
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
            const coc = (await $(
                this.options.metadataRepository.get(
                    "categoryOptionCombos",
                    id,
                    "id,displayName,categoryCombo[id,displayName],categoryOptions[id,displayName]"
                )
            )) as CategoryOptionCombo;

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

            const dataSetKeys = uniqueById(
                [...dataSetsPlain, ...dataSetsByCombo.items].filter(
                    item => !dataSetsOverride.some(override => override.id === item.id)
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
            const dataSet = (await $(
                this.options.metadataRepository.get(
                    "dataSets",
                    id,
                    "id,displayName,categoryCombo[id,displayName,categories[id,displayName,categoryOptions[id,displayName]]],dataSetElements[dataElement[id,displayName,categoryCombo[id,displayName]],categoryCombo[id,displayName]]"
                )
            )) as DataSet;

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
        return Future.block(async $ => {
            const lists = await $(
                Future.sequential(
                    categories.map(category =>
                        this.options.metadataRepository.list({
                            type: "categoryCombos",
                            fields: "id,displayName",
                            filters: [`categories.id:eq:${category.id}`],
                            paging: false,
                        })
                    )
                )
            );

            const items = uniqueById(lists.flatMap(list => list.items));
            return { items };
        });
    }

    private listDataElementsByCategoryCombos(
        categoryCombos: MetadataItem[]
    ): FutureData<MetadataList> {
        return Future.block(async $ => {
            const lists = await $(
                Future.sequential(
                    categoryCombos.map(combo =>
                        this.options.metadataRepository.list({
                            type: "dataElements",
                            fields: "id,displayName",
                            filters: [`categoryCombo.id:eq:${combo.id}`],
                            paging: false,
                        })
                    )
                )
            );

            const items = uniqueById(lists.flatMap(list => list.items));
            return { items };
        });
    }

    private listDataSetsByCategoryComboIds(
        categoryCombos: MetadataItem[]
    ): FutureData<MetadataList> {
        return Future.block(async $ => {
            const lists = await $(
                Future.sequential(
                    categoryCombos.map(combo =>
                        this.options.metadataRepository.list({
                            type: "dataSets",
                            fields: "id,displayName,categoryCombo[id,displayName],dataSetElements[dataElement[id,displayName,categoryCombo[id,displayName]],categoryCombo[id,displayName]]",
                            filters: [`categoryCombo.id:eq:${combo.id}`],
                            paging: false,
                        })
                    )
                )
            );

            const items = uniqueById(lists.flatMap(list => list.items));
            return { items };
        });
    }

    private listDataSetsByDataElementIds(dataElements: MetadataItem[]): FutureData<MetadataList> {
        return Future.block(async $ => {
            const lists = await $(
                Future.sequential(
                    dataElements.map(element =>
                        this.options.metadataRepository.list({
                            type: "dataSets",
                            fields: "id,displayName,categoryCombo[id,displayName],dataSetElements[dataElement[id,displayName,categoryCombo[id,displayName]],categoryCombo[id,displayName]]",
                            filters: [`dataSetElements.dataElement.id:eq:${element.id}`],
                            paging: false,
                        })
                    )
                )
            );

            const items = uniqueById(lists.flatMap(list => list.items));
            return { items };
        });
    }
}

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

    const categories = combo?.categories ?? [];
    categories.forEach(category => {
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
    const map = new Map<string, MetadataItem>();
    items.forEach(item => {
        map.set(item.id, item);
    });
    return Array.from(map.values());
}

function splitDataSetsByOverride(dataSets: MetadataItem[]) {
    const plain: DataSet[] = [];
    const overrides: DataSet[] = [];

    dataSets.forEach(item => {
        const dataSet = item as DataSet;
        const elements = dataSet.dataSetElements ?? [];
        const hasOverride = elements.some(element => {
            const overrideCombo = element.categoryCombo?.id;
            const defaultCombo = element.dataElement?.categoryCombo?.id;
            return Boolean(overrideCombo && defaultCombo && overrideCombo !== defaultCombo);
        });

        if (hasOverride) {
            overrides.push(dataSet);
        } else {
            plain.push(dataSet);
        }
    });

    return { plain, overrides };
}
