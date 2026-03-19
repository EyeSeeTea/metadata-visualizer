import { Future } from "$/domain/entities/generic/Future";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { SystemRepository, UiLocaleSettings } from "$/domain/repositories/SystemRepository";

export class SystemTestRepository implements SystemRepository {
    public getUiLocale(): FutureData<UiLocaleSettings> {
        return Future.success({ keyUiLocale: "en" });
    }
}
