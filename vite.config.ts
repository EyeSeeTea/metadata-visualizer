/// <reference types="vitest" />
import { ProxyOptions, UserConfig, defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import * as path from "path";

export default ({ mode }): UserConfig => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
    const proxy = getProxy(env);
    const appTitle = resolveAppTitle();
    const buildCommit = resolveBuildCommit();
    const buildTime = resolveBuildTime(env);

    // https://vitejs.dev/config/
    return defineConfig({
        base: "", // Relative paths
        define: {
            __APP_BUILD_COMMIT__: JSON.stringify(buildCommit),
            __APP_BUILD_TIME__: JSON.stringify(buildTime),
        },
        plugins: [
            injectAppTitlePlugin(appTitle),
            react(),
            checker({
                overlay: false,
                typescript: true,
                eslint: {
                    lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
                    dev: { logLevel: ["warning"] },
                },
            }),
        ],
        test: {
            environment: "jsdom",
            include: ["**/*.spec.{ts,tsx}"],
            setupFiles: "./src/tests/setup.js",
            exclude: ["node_modules", "src/tests/playwright"],
            globals: true,
        },
        server: {
            port: parseInt(env.VITE_PORT),
            host: "127.0.0.1",
            proxy: proxy,
        },
        resolve: {
            alias: {
                $: path.resolve(__dirname, "./src"),
            },
        },
    });
};

function injectAppTitlePlugin(appTitle: string) {
    return {
        name: "inject-app-title",
        transformIndexHtml(html: string) {
            return html.replace(/%APP_TITLE%/g, appTitle);
        },
    };
}

function resolveAppTitle() {
    try {
        const packageJsonPath = path.resolve(__dirname, "package.json");
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
            name?: string;
            "manifest.webapp"?: {
                name?: string;
            };
        };

        return packageJson["manifest.webapp"]?.name ?? packageJson.name ?? "Metadata Visualizer";
    } catch {
        return "Metadata Visualizer";
    }
}

function getProxy(env: Record<string, string>) {
    const dhis2UrlVar = "VITE_DHIS2_BASE_URL";
    const dhis2AuthVar = "DHIS2_AUTH";
    const targetUrl = env[dhis2UrlVar];
    const auth = env[dhis2AuthVar];
    const isBuild = env.NODE_ENV === "production";

    if (isBuild) {
        return {};
    } else if (!targetUrl) {
        console.error(`Set ${dhis2UrlVar}`);
        process.exit(1);
    } else {
        const proxy: Record<string, ProxyOptions> = {
            "/dhis2": {
                target: targetUrl,
                changeOrigin: true,
                rewrite: path => path.replace(/^\/dhis2/, ""),
                ...(auth ? { auth } : {}),
            },
        };

        return proxy;
    }
}

function resolveBuildCommit() {
    try {
        return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim();
    } catch {
        return "unknown";
    }
}

function resolveBuildTime(env: Record<string, string>) {
    if (env.VITE_APP_BUILD_TIME) {
        return env.VITE_APP_BUILD_TIME;
    }

    return new Date().toISOString();
}
