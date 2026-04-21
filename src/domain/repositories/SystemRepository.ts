import { FutureData } from "$/domain/entities/generic/FutureData";

export type UiLocaleSettings = {
    keyUiLocale: string;
};

export interface SystemRepository {
    getUiLocale(): FutureData<UiLocaleSettings>;
}
