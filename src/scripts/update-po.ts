import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const potPath = join(process.cwd(), "i18n", "en.pot");
const baseDir = join(process.cwd(), "i18n");

if (!existsSync(potPath)) {
    console.error(`Missing template file: ${potPath}`);
    process.exit(1);
}

const poFiles = findPoFiles(baseDir);

if (poFiles.length === 0) {
    process.exit(0);
}

const msgmergeCommand = resolveMsgmergeCommand();
if (!msgmergeCommand) {
    console.warn("msgmerge not found. Skipping .po updates.");
    console.warn("Install gettext (msgmerge) to update translations.");
    process.exit(0);
}

poFiles.forEach(filePath => {
    const result = spawnSync(msgmergeCommand, ["--backup=off", "-U", filePath, potPath], {
        stdio: "inherit",
    });
    if (result.error) {
        console.error(`Failed to run msgmerge: ${result.error.message}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
});

function findPoFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
        const entryPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            return findPoFiles(entryPath);
        }
        return entry.isFile() && entry.name.toLowerCase().endsWith(".po") ? [entryPath] : [];
    });
}

function resolveMsgmergeCommand(): string | null {
    const envOverride = process.env.MSGMERGE_PATH?.trim();
    if (envOverride && checkMsgmerge(envOverride)) {
        return envOverride;
    }

    if (checkMsgmerge("msgmerge")) {
        return "msgmerge";
    }

    const knownPaths = [
        "C:\\\\msys64\\\\usr\\\\bin\\\\msgmerge.exe",
        "C:\\\\msys64\\\\mingw64\\\\bin\\\\msgmerge.exe",
        "C:\\\\Program Files\\\\gettext\\\\bin\\\\msgmerge.exe",
    ];

    for (const candidate of knownPaths) {
        if (existsSync(candidate) && checkMsgmerge(candidate)) {
            return candidate;
        }
    }

    return null;
}

function checkMsgmerge(command: string): boolean {
    const result = spawnSync(command, ["--version"], { stdio: "ignore" });
    return !result.error && result.status === 0;
}
