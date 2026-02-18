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
        expect(nodeTypes).toEqual(["categories", "categoryCombos", "dataElements"]);

        const edgeLabels = graph.edges.map(edge => edge.label).sort();
        expect(edgeLabels).toEqual(["categories", "categoryCombo"]);
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

    it("links users, userRoles and userGroups only through explicit membership fields", () => {
        const metadataPackage = {
            users: [
                {
                    id: "u1",
                    displayName: "User 1",
                    userRoles: [{ id: "ur1" }],
                },
            ],
            userRoles: [{ id: "ur1", name: "Role 1" }],
            userGroups: [{ id: "ug1", name: "Group 1", users: [{ id: "u1" }] }],
        };

        const index = indexJsonPackage(metadataPackage);
        const user = requireFirst(index.entriesByType.users, "users");
        const userRole = requireFirst(index.entriesByType.userRoles, "userRoles");
        const userGroup = requireFirst(index.entriesByType.userGroups, "userGroups");

        [user.key, userRole.key, userGroup.key].forEach(centerKey => {
            const graph = buildJsonPackageDependencyGraph(index, centerKey);
            const types = new Set(graph.nodes.map(node => node.type));

            expect(types.has("users")).toBe(true);
            expect(types.has("userRoles")).toBe(true);
            expect(types.has("userGroups")).toBe(true);
        });
    });

    it("does not create security links from sharing permissions", () => {
        const metadataPackage = {
            users: [{ id: "u1", displayName: "User 1", userRoles: [{ id: "ur1" }] }],
            userRoles: [
                {
                    id: "ur1",
                    name: "Role 1",
                    sharing: {
                        owner: "u1",
                        userGroups: {
                            ug1: { id: "ug1" },
                        },
                        users: {},
                    },
                },
            ],
            userGroups: [{ id: "ug1", name: "Group 1", users: [] }],
        };

        const index = indexJsonPackage(metadataPackage);
        const userRole = requireFirst(index.entriesByType.userRoles, "userRoles");
        const graph = buildJsonPackageDependencyGraph(index, userRole.key);

        const types = new Set(graph.nodes.map(node => node.type));
        expect(types.has("users")).toBe(true);
        expect(types.has("userRoles")).toBe(true);
        expect(types.has("userGroups")).toBe(false);
    });

    it("avoids same-type sibling expansion for indicators", () => {
        const metadataPackage = {
            indicators: [
                {
                    id: "ind1",
                    displayName: "Indicator 1",
                    indicatorGroups: [{ id: "ig1" }],
                    indicatorType: { id: "it1" },
                },
                {
                    id: "ind2",
                    displayName: "Indicator 2",
                    indicatorGroups: [{ id: "ig1" }],
                    indicatorType: { id: "it1" },
                },
            ],
            indicatorGroups: [{ id: "ig1", displayName: "Indicator group 1" }],
            indicatorTypes: [{ id: "it1", displayName: "Indicator type 1" }],
        };

        const index = indexJsonPackage(metadataPackage);
        const indicator = requireFirst(index.entriesByType.indicators, "indicators");
        const graph = buildJsonPackageDependencyGraph(index, indicator.key);

        const indicatorNodes = graph.nodes.filter(node => node.type === "indicators");
        expect(indicatorNodes).toHaveLength(1);

        const linkedTypes = graph.nodes
            .filter(node => node.key !== indicator.key)
            .map(node => node.type);
        expect(linkedTypes).toContain("indicatorGroups");
        expect(linkedTypes).toContain("indicatorTypes");
    });

    it("keeps dataSets graph focused while still resolving multiple category paths", () => {
        const metadataPackage = {
            dataSets: [
                {
                    id: "ds1",
                    displayName: "DataSet 1",
                    categoryCombo: { id: "cc1" },
                    dataSetElements: [{ dataElement: { id: "de1" } }],
                },
            ],
            sections: [
                {
                    id: "sec1",
                    displayName: "Section 1",
                    dataSet: { id: "ds1" },
                    dataElements: [{ id: "de1" }],
                },
            ],
            dataElements: [
                { id: "de1", displayName: "DE 1", categoryCombo: { id: "cc2" } },
                { id: "de2", displayName: "DE 2", categoryCombo: { id: "cc1" } },
            ],
            categoryCombos: [
                { id: "cc1", displayName: "Combo 1", categories: [{ id: "cat1" }] },
                { id: "cc2", displayName: "Combo 2", categories: [{ id: "cat2" }] },
            ],
            categories: [
                { id: "cat1", displayName: "Category 1" },
                { id: "cat2", displayName: "Category 2" },
            ],
        };

        const index = indexJsonPackage(metadataPackage);
        const dataSet = requireFirst(index.entriesByType.dataSets, "dataSets");
        const graph = buildJsonPackageDependencyGraph(index, dataSet.key);

        const dataElementIds = graph.nodes
            .filter(node => node.type === "dataElements")
            .map(node => node.id);
        expect(dataElementIds).toContain("de1");
        expect(dataElementIds).not.toContain("de2");

        const categoryIds = graph.nodes
            .filter(node => node.type === "categories")
            .map(node => node.id)
            .sort();
        expect(categoryIds).toEqual(["cat1", "cat2"]);
    });

    it("prioritizes sections over dataElements when node limit is reached", () => {
        const dataElementCount = 400;
        const metadataPackage = {
            dataSets: [
                {
                    id: "ds1",
                    displayName: "DataSet 1",
                    dataSetElements: Array.from({ length: dataElementCount }, (_, index) => ({
                        dataElement: { id: `de${index}` },
                    })),
                    sections: [{ id: "sec1" }, { id: "sec2" }],
                },
            ],
            dataElements: Array.from({ length: dataElementCount }, (_, index) => ({
                id: `de${index}`,
                displayName: `Data element ${index}`,
            })),
            sections: [
                { id: "sec1", displayName: "Section 1" },
                { id: "sec2", displayName: "Section 2" },
            ],
        };

        const index = indexJsonPackage(metadataPackage);
        const dataSet = requireFirst(index.entriesByType.dataSets, "dataSets");
        const graph = buildJsonPackageDependencyGraph(index, dataSet.key, 250);

        const sectionIds = graph.nodes
            .filter(node => node.type === "sections")
            .map(node => node.id)
            .sort();
        expect(sectionIds).toEqual(["sec1", "sec2"]);
    });

    it("keeps dashboard maps focused and avoids map expansion through indicator type hubs", () => {
        const metadataPackage = {
            dashboards: [
                {
                    id: "d1",
                    displayName: "Dashboard 1",
                    dashboardItems: [{ visualization: { id: "v1" } }, { map: { id: "m1" } }],
                },
            ],
            visualizations: [
                {
                    id: "v1",
                    displayName: "Visualization 1",
                    dataDimensionItems: [{ id: "i1" }],
                },
            ],
            indicators: [
                { id: "i1", displayName: "Indicator 1", indicatorType: { id: "it1" } },
                { id: "i2", displayName: "Indicator 2", indicatorType: { id: "it1" } },
            ],
            indicatorTypes: [{ id: "it1", displayName: "Indicator type 1" }],
            maps: [
                { id: "m1", displayName: "Map 1" },
                { id: "m2", displayName: "Map 2", mapViews: [{ id: "i2" }] },
            ],
        };

        const index = indexJsonPackage(metadataPackage);
        const dashboard = requireFirst(index.entriesByType.dashboards, "dashboards");
        const graph = buildJsonPackageDependencyGraph(index, dashboard.key);

        const mapIds = graph.nodes
            .filter(node => node.type === "maps")
            .map(node => node.id)
            .sort();

        expect(mapIds).toEqual(["m1"]);
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
