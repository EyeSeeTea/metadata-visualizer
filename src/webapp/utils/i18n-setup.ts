import i18n from "@dhis2/d2-i18n";
import { UiLocaleSettings } from "$/domain/repositories/SystemRepository";

const rtlLangs = ["ar", "fa", "ur"];

const isLangRTL = (code: string) => {
    const prefixed = rtlLangs.map(c => `${c}-`);
    return rtlLangs.includes(code) || prefixed.some(c => code && code.startsWith(c));
};

export const configI18n = ({ keyUiLocale }: UiLocaleSettings) => {
    i18n.changeLanguage(keyUiLocale);
    document.documentElement.setAttribute("dir", isLangRTL(keyUiLocale) ? "rtl" : "ltr");
};
