import { describe, expect, it } from "vitest";
import { MetadataTestRepository } from "$/data/repositories/MetadataTestRepository";
import { MetadataItem } from "$/domain/metadata/MetadataItem";
import { ResourceType } from "$/domain/metadata/ResourceType";
import { BuildMetadataGraphUseCase } from "$/domain/usecases/metadata/BuildMetadataGraphUseCase";

const OPTION_ID = "CO1";
const CATEGORY_ID = "CAT1";
const COMBO_ID = "CC1";
const OPTION_COMBO_ID = "COC1";

function buildUseCase(seed: ReadonlyMap<ResourceType, MetadataItem[]>) {
    return new BuildMetadataGraphUseCase({
        metadataRepository: new MetadataTestRepository(seed),
    });
}

function optionSeed(): ReadonlyMap<ResourceType, MetadataItem[]> {
    return new Map<ResourceType, MetadataItem[]>([
        ["categoryOptions", [{ type: "categoryOptions", id: OPTION_ID, displayName: "Option 1" }]],
        [
            "categories",
            [
                {
                    type: "categories",
                    id: CATEGORY_ID,
                    displayName: "Category 1",
                    categoryOptions: [{ id: OPTION_ID }],
                },
            ],
        ],
        [
            "categoryCombos",
            [
                {
                    type: "categoryCombos",
                    id: COMBO_ID,
                    displayName: "Combo 1",
                    categories: [{ id: CATEGORY_ID }],
                },
            ],
        ],
        [
            "categoryOptionCombos",
            [
                {
                    type: "categoryOptionCombos",
                    id: OPTION_COMBO_ID,
                    displayName: "Option combo 1",
                    categoryOptions: [{ id: OPTION_ID }],
                },
            ],
        ],
    ]);
}

describe("BuildMetadataGraphUseCase", () => {
    describe("buildCategoryOptionGraph", () => {
        it("includes the parent category combos in the graph", async () => {
            const useCase = buildUseCase(optionSeed());

            const graph = await useCase
                .execute({ type: "categoryOptions", id: OPTION_ID })
                .toPromise();

            const comboNode = graph.nodes.find(
                node => node.type === "categoryCombos" && node.id === COMBO_ID
            );
            expect(comboNode).toEqual({
                key: `categoryCombos:${COMBO_ID}`,
                type: "categoryCombos",
                id: COMBO_ID,
                displayName: "Combo 1",
            });

            const comboGroup = graph.groups.find(group => group.id === "category-combos");
            expect(comboGroup).toEqual({
                id: "category-combos",
                title: "Category combos",
                nodeKeys: [`categoryCombos:${COMBO_ID}`],
                direction: "parent",
            });

            const comboEdge = graph.edges.find(
                edge =>
                    edge.from === `categoryCombos:${COMBO_ID}` &&
                    edge.to === `categoryOptions:${OPTION_ID}`
            );
            expect(comboEdge).toEqual({
                from: `categoryCombos:${COMBO_ID}`,
                to: `categoryOptions:${OPTION_ID}`,
                label: "categoryCombos",
            });
        });

        it("includes the parent category and child category option combo groups", async () => {
            const useCase = buildUseCase(optionSeed());

            const graph = await useCase
                .execute({ type: "categoryOptions", id: OPTION_ID })
                .toPromise();

            const categoryGroup = graph.groups.find(group => group.id === "categories");
            expect(categoryGroup).toEqual({
                id: "categories",
                title: "Categories",
                nodeKeys: [`categories:${CATEGORY_ID}`],
                direction: "parent",
            });

            const optionComboGroup = graph.groups.find(
                group => group.id === "category-option-combos"
            );
            expect(optionComboGroup).toEqual({
                id: "category-option-combos",
                title: "Category option combos",
                nodeKeys: [`categoryOptionCombos:${OPTION_COMBO_ID}`],
                direction: "child",
            });
        });

        it("centers the graph on the selected category option", async () => {
            const useCase = buildUseCase(optionSeed());

            const graph = await useCase
                .execute({ type: "categoryOptions", id: OPTION_ID })
                .toPromise();

            expect(graph.center).toEqual(`categoryOptions:${OPTION_ID}`);
        });
    });
});
