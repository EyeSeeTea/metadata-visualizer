/// <reference types="vitest" />
import { ProxyOptions, UserConfig, defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import nodePolyfills from "vite-plugin-node-stdlib-browser";
import { execSync } from "child_process";
import * as path from "path";

export default ({ mode }): UserConfig => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
    const proxy = getProxy(env);
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
            nodePolyfills(),
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
