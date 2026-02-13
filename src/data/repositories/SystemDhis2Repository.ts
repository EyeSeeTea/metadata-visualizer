import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { FutureData } from "$/domain/entities/generic/FutureData";
import { SystemRepository, UiLocaleSettings } from "$/domain/repositories/SystemRepository";

export class SystemDhis2Repository implements SystemRepository {
    constructor(private dataEngine: DataEngine) {}

    public getUiLocale(): FutureData<UiLocaleSettings> {
        return promiseToFuture<UiLocaleSettings>(signal =>
            this.dataEngine
                .query(
                    {
                        locale: {
                            resource: "userSettings/keyUiLocale",
                        },
                    },
                    { signal }
                )
                .then(res => ({
                    keyUiLocale: String((res as { locale?: unknown }).locale ?? "en"),
                }))
        );
    }
}
