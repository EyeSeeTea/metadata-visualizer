import type { DataEngine } from "$/types/dhis2-app-runtime";
import { promiseToFuture } from "$/data/api-futures";
import { isRecord } from "$/data/dhis2-payload-guards";
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
                .then(res => ({ keyUiLocale: extractLocale(res) }))
        );
    }
}

function extractLocale(response: unknown): string {
    if (!isRecord(response)) return "en";
    const { locale } = response;
    if (typeof locale === "string" && locale.length > 0) return locale;
    if (typeof locale === "number") return String(locale);
    return "en";
}
