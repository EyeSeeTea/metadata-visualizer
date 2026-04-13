import { FutureData } from "$/domain/entities/generic/FutureData";
import { SystemRepository, UiLocaleSettings } from "$/domain/repositories/SystemRepository";

export class GetUiLocaleUseCase {
    constructor(private options: { systemRepository: SystemRepository }) {}

    public execute(): FutureData<UiLocaleSettings> {
        return this.options.systemRepository.getUiLocale();
    }
}
