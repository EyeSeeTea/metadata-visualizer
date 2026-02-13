import { FutureData } from "$/domain/entities/generic/FutureData";
import { MetadataList } from "$/domain/metadata/MetadataItem";
import { MetadataRepository } from "$/domain/repositories/MetadataRepository";

export class ListCategoryOptionCombosUseCase {
    constructor(private options: { metadataRepository: MetadataRepository }) {}

    public execute(input: {
        categoryComboId: string;
        page: number;
        pageSize: number;
    }): FutureData<MetadataList> {
        return this.options.metadataRepository.list({
            type: "categoryOptionCombos",
            fields: "id,displayName,categoryCombo[id,displayName]",
            filters: [`categoryCombo.id:eq:${input.categoryComboId}`],
            page: input.page,
            pageSize: input.pageSize,
            paging: true,
        });
    }
}
