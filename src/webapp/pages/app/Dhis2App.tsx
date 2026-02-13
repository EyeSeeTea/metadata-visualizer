import React from "react";
import { Provider } from "@dhis2/app-runtime";
import { App } from "./App";

export function Dhis2App(_props: {}) {
    const [baseUrlRes, setBaseUrlRes] = React.useState<BaseUrlResult>({ type: "loading" });

    React.useEffect(() => {
        getBaseUrl()
            .then(baseUrl => setBaseUrlRes({ type: "loaded", data: { baseUrl } }))
            .catch(error =>
                setBaseUrlRes({
                    type: "error",
                    error: { baseUrl: env["VITE_DHIS2_BASE_URL"], error: error as Error },
                })
            );
    }, []);

    switch (baseUrlRes.type) {
        case "loading":
            return <h3>Loading...</h3>;
        case "error": {
            const { baseUrl, error } = baseUrlRes.error;
            const fallbackBaseUrl = baseUrl || "/dhis2";
            return (
                <div style={{ margin: 20 }}>
                    <h3>{error.message}</h3>
                    <a rel="noopener noreferrer" target="_blank" href={fallbackBaseUrl}>
                        Login {fallbackBaseUrl}
                    </a>
                </div>
            );
        }
        case "loaded": {
            const { baseUrl } = baseUrlRes.data;
            type ProviderProps = React.ComponentProps<typeof Provider>;
            const config: ProviderProps["config"] = { baseUrl, apiVersion: 41 };

            return (
                <Provider
                    config={config}
                    plugin={false}
                    parentAlertsAdd={() => {}}
                    showAlertsInPlugin={false}
                >
                    <App />
                </Provider>
            );
        }
    }
}

const env = import.meta.env;
const isDev = env.DEV;

async function getBaseUrl() {
    if (isDev) {
        return "/dhis2"; // See vite.config.ts: defineConfig -> server.proxy
    } else {
        return getInjectedBaseUrl() || getBaseUrlFromManifest();
    }
}

// Get from manifest.webapp: activities.dhis.href
async function getBaseUrlFromManifest(): Promise<string> {
    const response = await fetch("manifest.webapp");
    const manifest = await response.json();
    const { href } = manifest.activities.dhis;

    if (!href || href === "*") {
        throw new Error("Base URL not found in manifest.webapp (see DHIS2-19708)");
    } else {
        return href;
    }
}

// Injected by backend (DHIS2 +41) in public.html meta tag "dhis2-base-url"
function getInjectedBaseUrl() {
    const baseUrl = document.querySelector('meta[name="dhis2-base-url"]')?.getAttribute("content");

    if (baseUrl && baseUrl !== "__DHIS2_BASE_URL__") {
        return baseUrl;
    } else {
        return null;
    }
}

type Result<Data, E> =
    | { type: "loading" }
    | { type: "loaded"; data: Data }
    | { type: "error"; error: E };

type BaseUrlResult = Result<{ baseUrl: string }, { baseUrl?: string; error: Error }>;
