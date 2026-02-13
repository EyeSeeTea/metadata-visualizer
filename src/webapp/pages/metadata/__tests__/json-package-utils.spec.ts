import {
    buildJsonPackageDependencyGraph,
    indexJsonPackage,
} from "$/webapp/pages/metadata/json-package-utils";

describe("json-package-utils", () => {
    it("indexes metadata arrays by type and builds dependency graph transitively", () => {
        const metadataPackage = {
            dataElements: [
                {
                    id: "de1",
                    displayName: "Data Element 1",
                    categoryCombo: { id: "cc1", displayName: "Default combo" },
                    legendSets: [{ id: "ls1" }],
                },
            ],
            categoryCombos: [
                {
                    id: "cc1",
                    displayName: "Default combo",
                    categories: [{ id: "cat1" }],
                },
            ],
            categories: [{ id: "cat1", displayName: "Category 1" }],
            legendSets: [{ id: "ls1", name: "Legend set 1" }],
        };

        const index = indexJsonPackage(metadataPackage);
        expect(index.types).toEqual(["categoryCombos", "categories", "dataElements", "legendSets"]);
        expect(index.entriesByType.dataElements).toHaveLength(1);

        const dataElement = requireFirst(index.entriesByType.dataElements, "dataElements");
        const graph = buildJsonPackageDependencyGraph(index, dataElement.key);

        const nodeTypes = graph.nodes.map(node => node.type).sort();
        expect(nodeTypes).toEqual(["categories", "categoryCombos", "dataElements", "legendSets"]);

        const edgeLabels = graph.edges.map(edge => edge.label).sort();
        expect(edgeLabels).toEqual(["categories", "categoryCombo", "legendSets"]);
    });

    it("fails with invalid package root", () => {
        expect(() => indexJsonPackage([])).toThrow("Invalid package format: expected a JSON object");
    });

    it("ignores nested references outside first-level fields (e.g. sharing settings)", () => {
        const metadataPackage = {
            categories: [
                {
                    id: "cat1",
                    displayName: "Category 1",
                    sharing: {
                        users: {
                            abc123: { access: "rw------" },
                        },
                        userGroups: {
                            grp1: { access: "r-------", id: "ug1" },
                        },
                    },
                    categoryOptions: [{ id: "co1" }],
                },
            ],
            categoryOptions: [{ id: "co1", displayName: "Option 1" }],
            userGroups: [{ id: "ug1", name: "Should not be linked via sharing" }],
        };

        const index = indexJsonPackage(metadataPackage);
        const category = requireFirst(index.entriesByType.categories, "categories");
        const graph = buildJsonPackageDependencyGraph(index, category.key);

        const linkedTypes = graph.nodes
            .filter(node => node.key !== category.key)
            .map(node => node.type)
            .sort();

        expect(linkedTypes).toEqual(["categoryOptions"]);
    });

    it("includes nested ids inside first-level relation fields (e.g. dataSetElements -> dataElement)", () => {
        const metadataPackage = {
            dataSets: [
                {
                    id: "ds1",
                    displayName: "Data set 1",
                    dataSetElements: [{ dataElement: { id: "de1" } }],
                },
            ],
            dataElements: [{ id: "de1", displayName: "Data element 1" }],
        };

        const index = indexJsonPackage(metadataPackage);
        const dataSet = requireFirst(index.entriesByType.dataSets, "dataSets");
        const graph = buildJsonPackageDependencyGraph(index, dataSet.key);

        const linkedTypes = graph.nodes
            .filter(node => node.key !== dataSet.key)
            .map(node => node.type);

        expect(linkedTypes).toContain("dataElements");
    });

    it("includes reverse references (category -> categoryOptions <- categoryOptionCombos)", () => {
        const metadataPackage = {
            categories: [
                {
                    id: "cat1",
                    displayName: "Category 1",
                    categoryOptions: [{ id: "co1" }],
                },
            ],
            categoryOptions: [{ id: "co1", displayName: "Option 1" }],
            categoryOptionCombos: [
                {
                    id: "coc1",
                    displayName: "Option combo 1",
                    categoryOptions: [{ id: "co1" }],
                },
            ],
        };

        const index = indexJsonPackage(metadataPackage);
        const category = requireFirst(index.entriesByType.categories, "categories");
        const graph = buildJsonPackageDependencyGraph(index, category.key);

        const linkedTypes = graph.nodes
            .filter(node => node.key !== category.key)
            .map(node => node.type);

        expect(linkedTypes).toContain("categoryOptions");
        expect(linkedTypes).toContain("categoryOptionCombos");
    });
});

function requireFirst<T>(items: T[] | undefined, label: string): T {
    const first = items?.[0];
    expect(first).toBeDefined();
    if (!first) {
        throw new Error(`${label} should contain at least one item in test fixture`);
    }
    return first;
}
